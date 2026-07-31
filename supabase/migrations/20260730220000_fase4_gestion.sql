-- Fase 4 — Gestión y análisis
-- Inventario append-only, stock derivado, alertas de reorden.
-- Reportes usan agregados en app; export PII restringido a admin (capa app + audit).

CREATE TYPE inventory_movement_tipo AS ENUM (
  'entrada',
  'salida',
  'ajuste',
  'venta',
  'consumo_sesion'
);

-- ---------------------------------------------------------------------------
-- Productos (catálogo físico; opcionalmente ligados a services.tipo = producto)
-- ---------------------------------------------------------------------------

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  sku TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_venta NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
  stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, sku)
);

CREATE INDEX products_clinic_idx ON products(clinic_id);
CREATE INDEX products_service_idx ON products(service_id) WHERE service_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Movimientos append-only (existencia = SUM(cantidad_delta))
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  tipo inventory_movement_tipo NOT NULL,
  -- Positivo = entra; negativo = sale. Nunca cero.
  cantidad_delta INT NOT NULL CHECK (cantidad_delta <> 0),
  motivo TEXT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  appointment_service_id UUID REFERENCES appointment_services(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_sign_ck CHECK (
    (tipo = 'entrada' AND cantidad_delta > 0)
    OR (tipo IN ('salida', 'venta', 'consumo_sesion') AND cantidad_delta < 0)
    OR (tipo = 'ajuste' AND cantidad_delta <> 0)
  )
);

CREATE INDEX inventory_movements_product_idx
  ON inventory_movements(product_id, created_at DESC);
CREATE INDEX inventory_movements_clinic_idx
  ON inventory_movements(clinic_id, created_at DESC);

-- Sin UPDATE/DELETE a nivel de privilegios (append-only)
REVOKE UPDATE, DELETE ON inventory_movements FROM authenticated, anon, PUBLIC;
GRANT SELECT, INSERT ON inventory_movements TO authenticated;

-- Vista de stock derivado (no es contador editable)
CREATE OR REPLACE VIEW product_stock AS
SELECT
  p.id AS product_id,
  p.clinic_id,
  p.nombre,
  p.stock_minimo,
  p.activo,
  COALESCE(SUM(m.cantidad_delta), 0)::INT AS existencia,
  (COALESCE(SUM(m.cantidad_delta), 0) <= p.stock_minimo) AS bajo_minimo
FROM products p
LEFT JOIN inventory_movements m ON m.product_id = p.id
GROUP BY p.id, p.clinic_id, p.nombre, p.stock_minimo, p.activo;

GRANT SELECT ON product_stock TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;

-- products: lectura staff; escritura admin/recepcion
CREATE POLICY products_select ON products
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY products_write ON products
  FOR ALL TO authenticated
  USING (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista')
  );

-- movements: SELECT staff; INSERT admin/recepcionista/terapeuta (consumo);
-- sin UPDATE/DELETE policies (= denegado)
CREATE POLICY inventory_movements_select ON inventory_movements
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY inventory_movements_insert ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.current_staff_role() IN ('admin', 'recepcionista', 'terapeuta')
    AND created_by = public.current_staff_id()
  );

-- Vista: seguridad via tablas base (security_invoker en PG15+)
DO $$
BEGIN
  ALTER VIEW product_stock SET (security_invoker = true);
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Registrar movimiento y alertar si queda bajo mínimo
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_product_id UUID,
  p_tipo inventory_movement_tipo,
  p_cantidad INT, -- siempre positiva; el signo lo aplica el tipo (ajuste: p_signed)
  p_motivo TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_signed_delta INT DEFAULT NULL -- solo para ajuste
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  v_staff UUID := public.current_staff_id();
  v_role TEXT := public.current_staff_role();
  v_product products%ROWTYPE;
  v_delta INT;
  v_stock INT;
  v_mov_id UUID;
BEGIN
  IF v_role NOT IN ('admin', 'recepcionista', 'terapeuta') THEN
    RAISE EXCEPTION 'Sin permiso de inventario';
  END IF;

  IF p_tipo = 'consumo_sesion' AND v_role = 'recepcionista' THEN
    -- recepción puede registrar consumo si hace falta; permitido
    NULL;
  END IF;

  IF p_tipo IN ('entrada', 'salida', 'ajuste') AND v_role = 'terapeuta' THEN
    RAISE EXCEPTION 'El terapeuta solo puede registrar consumo_sesion';
  END IF;

  SELECT * INTO v_product FROM products
  WHERE id = p_product_id AND clinic_id = v_clinic AND activo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

  IF p_tipo = 'ajuste' THEN
    IF p_signed_delta IS NULL OR p_signed_delta = 0 THEN
      RAISE EXCEPTION 'Ajuste requiere delta distinto de cero';
    END IF;
    v_delta := p_signed_delta;
  ELSIF p_tipo = 'entrada' THEN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    v_delta := p_cantidad;
  ELSE
    -- salida, venta, consumo_sesion
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    v_delta := -p_cantidad;
  END IF;

  -- Stock actual
  SELECT COALESCE(SUM(cantidad_delta), 0) INTO v_stock
  FROM inventory_movements
  WHERE product_id = p_product_id;

  IF v_stock + v_delta < 0 THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE';
  END IF;

  INSERT INTO inventory_movements (
    clinic_id, product_id, tipo, cantidad_delta, motivo,
    appointment_id, created_by
  ) VALUES (
    v_clinic, p_product_id, p_tipo, v_delta, p_motivo,
    p_appointment_id, v_staff
  ) RETURNING id INTO v_mov_id;

  v_stock := v_stock + v_delta;

  IF v_stock <= v_product.stock_minimo THEN
    INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
    VALUES (
      v_clinic,
      'admin',
      'inventario_reorden',
      'Stock bajo mínimo',
      format('%s: %s %s (mín. %s)', v_product.nombre, v_stock, v_product.unidad, v_product.stock_minimo),
      jsonb_build_object(
        'product_id', p_product_id,
        'existencia', v_stock,
        'stock_minimo', v_product.stock_minimo
      )
    );
    INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
    VALUES (
      v_clinic,
      'recepcionista',
      'inventario_reorden',
      'Stock bajo mínimo',
      format('%s: %s %s (mín. %s)', v_product.nombre, v_stock, v_product.unidad, v_product.stock_minimo),
      jsonb_build_object(
        'product_id', p_product_id,
        'existencia', v_stock,
        'stock_minimo', v_product.stock_minimo
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'movement_id', v_mov_id,
    'existencia', v_stock,
    'bajo_minimo', v_stock <= v_product.stock_minimo
  );
END;
$$;

-- Venta de producto ligada a cita (appointment_services + movimiento venta)
CREATE OR REPLACE FUNCTION public.sell_product(
  p_product_id UUID,
  p_appointment_id UUID,
  p_cantidad INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID := public.current_clinic_id();
  v_staff UUID := public.current_staff_id();
  v_role TEXT := public.current_staff_role();
  v_product products%ROWTYPE;
  v_service_id UUID;
  v_appt appointments%ROWTYPE;
  v_as_id UUID;
  v_stock INT;
BEGIN
  IF v_role NOT IN ('admin', 'recepcionista') THEN
    RAISE EXCEPTION 'Sin permiso para vender productos';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT * INTO v_product FROM products
  WHERE id = p_product_id AND clinic_id = v_clinic AND activo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

  SELECT * INTO v_appt FROM appointments
  WHERE id = p_appointment_id AND clinic_id = v_clinic;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cita no encontrada'; END IF;

  SELECT COALESCE(SUM(cantidad_delta), 0) INTO v_stock
  FROM inventory_movements WHERE product_id = p_product_id;
  IF v_stock < p_cantidad THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE';
  END IF;

  -- Asegurar servicio tipo producto
  v_service_id := v_product.service_id;
  IF v_service_id IS NULL THEN
    INSERT INTO services (
      clinic_id, tipo, titulo, descripcion, costo, activo
    ) VALUES (
      v_clinic, 'producto', v_product.nombre, v_product.descripcion,
      v_product.precio_venta, true
    ) RETURNING id INTO v_service_id;

    UPDATE products SET service_id = v_service_id, updated_at = now()
    WHERE id = p_product_id;
  END IF;

  INSERT INTO appointment_services (
    clinic_id, appointment_id, service_id, costo_aplicado, cantidad, notas
  ) VALUES (
    v_clinic, p_appointment_id, v_service_id, v_product.precio_venta, p_cantidad,
    format('producto:%s', p_product_id)
  ) RETURNING id INTO v_as_id;

  INSERT INTO inventory_movements (
    clinic_id, product_id, tipo, cantidad_delta, motivo,
    appointment_id, appointment_service_id, created_by
  ) VALUES (
    v_clinic, p_product_id, 'venta', -p_cantidad,
    'Venta en cita', p_appointment_id, v_as_id, v_staff
  );

  v_stock := v_stock - p_cantidad;

  IF v_stock <= v_product.stock_minimo THEN
    INSERT INTO notifications (clinic_id, role_destino, tipo, titulo, cuerpo, payload)
    VALUES (
      v_clinic, 'admin', 'inventario_reorden', 'Stock bajo mínimo',
      format('%s: %s %s (mín. %s)', v_product.nombre, v_stock, v_product.unidad, v_product.stock_minimo),
      jsonb_build_object('product_id', p_product_id, 'existencia', v_stock)
    );
  END IF;

  RETURN jsonb_build_object(
    'appointment_service_id', v_as_id,
    'service_id', v_service_id,
    'existencia', v_stock,
    'linea_total', v_product.precio_venta * p_cantidad
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_inventory_movement(UUID, inventory_movement_tipo, INT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_product(UUID, UUID, INT) TO authenticated;

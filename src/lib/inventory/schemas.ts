import { z } from "zod";

export const ProductSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(64).optional().nullable(),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  unidad: z.string().trim().min(1).max(40).default("unidad"),
  precioVenta: z.string().regex(/^\d+(\.\d{1,2})?$/, "Precio inválido"),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});

export const InventoryMovementSchema = z.discriminatedUnion("tipo", [
  z.object({
    productId: z.string().uuid(),
    tipo: z.literal("entrada"),
    cantidad: z.coerce.number().int().positive(),
    motivo: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    productId: z.string().uuid(),
    tipo: z.literal("salida"),
    cantidad: z.coerce.number().int().positive(),
    motivo: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    productId: z.string().uuid(),
    tipo: z.literal("consumo_sesion"),
    cantidad: z.coerce.number().int().positive(),
    motivo: z.string().trim().max(500).optional().nullable(),
    appointmentId: z.string().uuid().optional().nullable(),
  }),
  z.object({
    productId: z.string().uuid(),
    tipo: z.literal("ajuste"),
    signedDelta: z.coerce
      .number()
      .int()
      .refine((n) => n !== 0, "Delta ≠ 0"),
    motivo: z.string().trim().max(500).optional().nullable(),
  }),
]);

export const SellProductSchema = z.object({
  productId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive().default(1),
});

import { z } from "zod";

export const PaymentMethodSchema = z.enum(["cash", "transferencia"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const RegisterPaymentSchema = z
  .object({
    appointmentId: z.string().uuid(),
    queueId: z.string().uuid(),
    expectedVersion: z.coerce.number().int().min(0),
    idempotencyKey: z
      .string()
      .min(16, "Clave de cobro inválida")
      .max(64, "Clave de cobro inválida"),
    metodoPago: PaymentMethodSchema,
    /** Monto recibido en efectivo (solo dígitos y hasta 2 decimales). */
    montoRecibido: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser numérico (ej. 150 o 150.50)")
      .optional(),
    /** Referencia de transferencia: solo dígitos. */
    referencia: z
      .string()
      .trim()
      .regex(/^\d+$/, "La referencia debe ser solo números")
      .max(64)
      .optional(),
    comprobantePath: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.metodoPago === "cash" && !val.montoRecibido) {
      ctx.addIssue({
        code: "custom",
        message: "Indique el monto recibido en efectivo",
        path: ["montoRecibido"],
      });
    }
    if (val.metodoPago === "transferencia" && !val.referencia?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indique el número de referencia",
        path: ["referencia"],
      });
    }
  });

export type RegisterPaymentInput = z.infer<typeof RegisterPaymentSchema>;

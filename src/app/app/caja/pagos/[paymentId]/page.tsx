import { notFound, redirect } from "next/navigation";

import { PaymentReceiptView } from "@/components/caja/PaymentReceiptView";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { requireMenuAccess } from "@/lib/permissions/require";
import { getPaymentReceiptAction } from "@/lib/payments/receipt";

type Props = { params: Promise<{ paymentId: string }> };

export const metadata = { title: "Factura — Terafis" };

export default async function PaymentReceiptPage({ params }: Props) {
  const { paymentId } = await params;
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.rol === "terapeuta") {
    return <p className="text-muted">Sin acceso a facturas de cobro.</p>;
  }
  await requireMenuAccess(staff, "caja");

  const result = await getPaymentReceiptAction(paymentId);
  if (!result.ok) {
    if (/no encontrado/i.test(result.error)) notFound();
    return <p className="text-muted">{result.error}</p>;
  }

  return <PaymentReceiptView receipt={result.receipt} />;
}

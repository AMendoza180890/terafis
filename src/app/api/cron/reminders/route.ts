import { NextResponse } from "next/server";

import { processCalendarSyncJobs } from "@/lib/calendar/sync";
import { processPendingDeliveries } from "@/lib/notifications/process-deliveries";

/**
 * Invocado por cron externo / pg_cron → HTTP.
 * Requiere header Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const deliveries = await processPendingDeliveries(25);
  const calendar = await processCalendarSyncJobs(10);

  return NextResponse.json({
    ok: true,
    deliveries,
    calendar,
  });
}

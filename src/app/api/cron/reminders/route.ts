import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processCalendarSyncJobs } from "@/lib/calendar/sync";
import { processPendingDeliveries } from "@/lib/notifications/process-deliveries";

/**
 * Jobs de recordatorios y sync de calendario.
 * No usa Vercel Cron (Hobby no lo permite de forma fiable).
 * Invocar con scheduler externo, GitHub Actions o curl:
 *   Authorization: Bearer $CRON_SECRET
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(auth);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

async function runReminders() {
  const deliveries = await processPendingDeliveries(25);
  const calendar = await processCalendarSyncJobs(10);
  return { deliveries, calendar };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result });
}

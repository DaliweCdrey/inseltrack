import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentReportingPeriod, isClientDue, sendClientReport } from "@/lib/reports/service";

export const runtime = "nodejs";

function authorized(request: NextRequest, secret: string) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduled reports are not configured: CRON_SECRET is missing." }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const period = getCurrentReportingPeriod(now);
  const supabase = createAdminClient();
  const { data: clients, error } = await supabase.from("clients")
    .select("id,name,reporting_day,reporting_time")
    .eq("is_active", true)
    .eq("reporting_enabled", true);
  if (error) return NextResponse.json({ error: "Could not load scheduled clients." }, { status: 500 });

  const results: Array<{ client_id: string; client_name: string; status: string; error?: string; report_id?: string }> = [];
  for (const client of clients ?? []) {
    if (!isClientDue(client, now)) continue;
    try {
      const result = await sendClientReport(client.id, "scheduled", period);
      results.push({
        client_id: client.id,
        client_name: client.name,
        status: result.ok ? "sent" : result.duplicate ? "skipped_duplicate" : "failed",
        ...(result.ok ? { report_id: result.report_id } : { error: result.error })
      });
    } catch (sendError) {
      results.push({ client_id: client.id, client_name: client.name, status: "failed", error: sendError instanceof Error ? sendError.message : "Report send failed." });
    }
  }

  return NextResponse.json({ period, processed: results.length, results });
}
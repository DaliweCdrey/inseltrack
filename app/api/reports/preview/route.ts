import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { z } from "zod";
import { buildClientReport, getCurrentReportingPeriod, ReportScopeError } from "@/lib/reports/service";

export async function GET(request: NextRequest) {
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) return NextResponse.json({ error:"Authentication and active approval required." }, { status:401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (typeof clientId !== "string" || !z.string().uuid().safeParse(clientId).success) {
    return NextResponse.json({ error:"A valid client_id is required." }, { status:400 });
  }
  if (auth.profile.role === "guest" && auth.profile.client_id !== clientId) {
    return NextResponse.json({ error:"You may only preview reports for your assigned client." }, { status:403 });
  }
  if (!["admin", "user", "guest"].includes(auth.profile.role)) {
    return NextResponse.json({ error:"Insufficient permissions." }, { status:403 });
  }

  try {
    const report = await buildClientReport(clientId, getCurrentReportingPeriod());
    return NextResponse.json({
      ...report,
      recipients: auth.profile.role === "guest" ? [] : report.recipients,
      recipient_count: report.recipients.length
    });
  } catch (error) {
    if (error instanceof ReportScopeError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load report data." }, { status: 500 });
  }
}

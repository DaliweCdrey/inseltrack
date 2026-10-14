import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendClientReport } from "@/lib/reports/service";

const bodySchema = z.object({ client_id:z.string().uuid(), force:z.boolean().optional().default(false) });

export async function POST(request: NextRequest) {
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) return NextResponse.json({ error:"Authentication and active approval required." }, { status:401 });
  if (auth.profile.role === "guest") return NextResponse.json({ error:"Guests cannot send reports." }, { status:403 });
  if (!["admin", "user"].includes(auth.profile.role)) {
    return NextResponse.json({ error:"Insufficient permissions." }, { status:403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error:"Invalid client id." }, { status:400 });
  if (parsed.data.force && auth.profile.role !== "admin") return NextResponse.json({ error:"Only admins may force a resend." }, { status:403 });

  try {
    const result = await sendClientReport(parsed.data.client_id, "manual", undefined, parsed.data.force);
    if (!result.ok) return NextResponse.json(result, { status: result.duplicate ? 409 : result.error.includes("not configured") ? 503 : 400 });
    return NextResponse.json({ ok: true, id: result.report_id, period: result.report.period });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send report.";
    const status = message.includes("mismatch") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  reporting_enabled: z.boolean(),
  reporting_day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  reporting_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM time.")
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) return NextResponse.json({ error: "Authentication and active approval required." }, { status: 401 });
  if (auth.profile.role !== "admin") return NextResponse.json({ error: "Only admins can manage report scheduling." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "A valid client id is required." }, { status: 400 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report settings." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update report settings." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
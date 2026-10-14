import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), promote_to_admin: z.boolean().optional(), client_id: z.string().uuid().optional() }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("change_role"), role: z.enum(["user", "admin"]) }),
  z.object({ action: z.literal("change_client"), client_id: z.string().uuid() }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("restore_pending") }),
  z.object({ action: z.literal("convert_guest_to_staff") })
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function hasAnotherApprovedAdmin(
  supabase: ReturnType<typeof createAdminClient>,
  targetId: string
) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("approved", true)
    .eq("is_active", true)
    .is("rejected_at", null)
    .neq("id", targetId);
  return !error && (count ?? 0) > 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCurrentProfile();
  if (!caller) return jsonError("Authentication required.", 401);
  if (!caller.profile.approved || !caller.profile.is_active || caller.profile.rejected_at) {
    return jsonError("An active, approved account is required.", 403);
  }
  if (caller.profile.role !== "admin") return jsonError("Administrator access required.", 403);

  const body = actionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid user action.", 400);

  const { id: targetId } = await params;
  const targetIdResult = z.string().uuid().safeParse(targetId);
  if (!targetIdResult.success) return jsonError("Invalid user id.", 400);

  const supabase = createAdminClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id,role,client_id,approved,is_active,rejected_at")
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) return jsonError("Could not load target account.", 500);
  if (!target) return jsonError("Account not found.", 404);

  const { action } = body.data;
  let changes: Record<string, unknown>;

  if (action === "approve") {
    if (target.approved || target.rejected_at || !target.is_active) {
      return jsonError("Only a pending account can be approved.", 409);
    }
    const promote = body.data.promote_to_admin ?? false;
    if (promote && target.role !== "user") {
      return jsonError("Only an internal user can be promoted to admin.", 400);
    }
    if (target.role === "guest") {
      const requestedClientId = body.data.client_id ?? target.client_id;
      if (!requestedClientId) return jsonError("Assign a client before approving this guest.", 400);
      const { data: client, error } = await supabase
        .from("clients")
        .select("id")
        .eq("id", requestedClientId)
        .eq("is_active", true)
        .maybeSingle();
      if (error || !client) return jsonError("Assign an active client before approving this guest.", 400);
      changes = { approved: true, rejected_at: null, client_id: requestedClientId };
    } else {
      changes = {
        approved: true,
        rejected_at: null,
        ...(promote ? { role: "admin", client_id: null } : {})
      };
    }
  } else if (action === "reject") {
    if (target.approved || target.rejected_at || !target.is_active) {
      return jsonError("Only a pending account can be rejected.", 409);
    }
    changes = { approved: false, rejected_at: new Date().toISOString() };
  } else if (action === "change_role") {
    if (target.role === "guest") {
      return jsonError("Guests must first be converted to an internal user.", 400);
    }
    changes = { role: body.data.role, client_id: null };
  } else if (action === "change_client") {
    if (target.role !== "guest") return jsonError("Only client accounts can be assigned a client.", 400);
    const { data: client, error } = await supabase
      .from("clients")
      .select("id")
      .eq("id", body.data.client_id)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !client) return jsonError("Select an existing active client.", 400);
    changes = { client_id: body.data.client_id };
  } else if (action === "disable") {
    if (!target.is_active) return jsonError("This account is already disabled.", 409);
    changes = { is_active: false };
  } else if (action === "enable") {
    if (target.is_active) return jsonError("This account is already active.", 409);
    changes = { is_active: true };
  } else if (action === "restore_pending") {
    if (!target.rejected_at) return jsonError("Only a rejected account can be restored to pending.", 409);
    changes = { approved: false, is_active: true, rejected_at: null };
  } else {
    if (target.role !== "guest") return jsonError("Only a client account can be converted to staff.", 400);
    changes = { role: "user", client_id: null };
  }

  const removesAdminAccess = target.role === "admin" && (
    (action === "change_role" && body.data.role !== "admin") ||
    action === "disable" || action === "reject" || action === "convert_guest_to_staff"
  );
  if (removesAdminAccess && !(await hasAnotherApprovedAdmin(supabase, targetId))) {
    return jsonError("This is the last active approved administrator; promote another admin first.", 409);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", targetId);
  if (updateError) return jsonError(updateError.message, 400);

  return NextResponse.json({ ok: true });
}

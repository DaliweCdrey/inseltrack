import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const recipientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  is_active: z.boolean()
});
const idSchema = z.string().uuid();

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function jsonSuccess(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return jsonError("Method not allowed. Use POST, PATCH, or DELETE.", 405);
}

export async function PUT() {
  return jsonError("Method not allowed. Use POST, PATCH, or DELETE.", 405);
}

export async function OPTIONS() {
  return jsonError("Method not allowed.", 405);
}

async function authorizeAdmin() {
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) {
    return { response: jsonError("Authentication and active approval required.", 401) };
  }
  if (auth.profile.role !== "admin") return { response: jsonError("Only admins can manage report recipients.", 403) };
  return {};
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await authorizeAdmin();
    if (gate.response) return gate.response;
    const { id: clientId } = await params;
    if (!idSchema.safeParse(clientId).success) return jsonError("A valid client id is required.", 400);
    const parsed = recipientSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "A valid name and email are required.", 400);

    const supabase = createAdminClient();
    const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (clientError) return jsonError("Could not verify the selected client.", 500);
    if (!client || client.id !== clientId) return jsonError("The selected client could not be found.", 404);

    const normalizedEmail = parsed.data.email.trim().toLocaleLowerCase("en-US");
    const { data: existing, error: lookupError } = await supabase.from("client_recipients")
      .select("id,email").eq("client_id", clientId);
    if (lookupError) return jsonError("Could not check for an existing recipient.", 500);
    if (existing?.some(recipient => recipient.email.trim().toLocaleLowerCase("en-US") === normalizedEmail)) {
      return jsonError("A recipient with this email already exists for this client.", 409);
    }

    const { data, error } = await supabase.from("client_recipients")
      .insert({ client_id: clientId, ...parsed.data, email: normalizedEmail })
      .select("id,name,email,is_active,client_id").single();
    if (error?.code === "23505") return jsonError("A recipient with this email already exists for this client.", 409);
    if (error || !data) return jsonError("Could not add the recipient to this client.", 500);
    if (data.client_id !== clientId) return jsonError("Recipient client scope validation failed.", 409);
    const { client_id: _clientId, ...recipient } = data;
    return jsonSuccess({ recipient }, 201);
  } catch (error) {
    console.error("Add client recipient failed:", error);
    return jsonError("An unexpected server error occurred while adding the recipient.", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await authorizeAdmin();
    if (gate.response) return gate.response;
    const { id: clientId } = await params;
    if (!idSchema.safeParse(clientId).success) return jsonError("A valid client id is required.", 400);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !idSchema.safeParse(body.id).success) return jsonError("A valid recipient id is required.", 400);
    const parsed = recipientSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid recipient.", 400);

    const supabase = createAdminClient();
    const normalizedEmail = parsed.data.email.trim().toLocaleLowerCase("en-US");
    const { data: existing, error: lookupError } = await supabase.from("client_recipients")
      .select("id,email").eq("client_id", clientId).neq("id", body.id);
    if (lookupError) return jsonError("Could not check for an existing recipient.", 500);
    if (existing?.some(recipient => recipient.email.trim().toLocaleLowerCase("en-US") === normalizedEmail)) {
      return jsonError("A recipient with this email already exists for this client.", 409);
    }
    const { data, error } = await supabase.from("client_recipients").update({ ...parsed.data, email: normalizedEmail })
      .eq("id", body.id).eq("client_id", clientId).select("id,name,email,is_active,client_id").single();
    if (error?.code === "23505") return jsonError("A recipient with this email already exists for this client.", 409);
    if (error || !data) return jsonError("Could not update that client recipient.", 404);
    if (data.client_id !== clientId) return jsonError("Recipient client scope validation failed.", 409);
    const { client_id: _clientId, ...recipient } = data;
    return jsonSuccess({ recipient });
  } catch (error) {
    console.error("Update client recipient failed:", error);
    return jsonError("An unexpected server error occurred while updating the recipient.", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await authorizeAdmin();
    if (gate.response) return gate.response;
    const { id: clientId } = await params;
    const recipientId = new URL(request.url).searchParams.get("recipient_id");
    if (!idSchema.safeParse(clientId).success || !idSchema.safeParse(recipientId).success) return jsonError("A valid client and recipient id are required.", 400);

    const supabase = createAdminClient();
    const { data: sending, error: historyError } = await supabase.from("weekly_reports").select("id")
      .eq("client_id", clientId).eq("send_state", "sending")
      .contains("recipient_snapshot", [{ recipient_id: recipientId }]).limit(1);
    if (historyError) return jsonError("Could not verify recipient history.", 500);
    if (sending?.length) return jsonError("This recipient is part of a report currently sending. Disable it instead.", 409);

    const { data: removed, error } = await supabase.from("client_recipients").delete()
      .eq("id", recipientId).eq("client_id", clientId).select("id").maybeSingle();
    if (error) return jsonError("Could not remove this recipient.", 500);
    if (!removed) return jsonError("Recipient not found for this client.", 404);
    return jsonSuccess({});
  } catch (error) {
    console.error("Delete client recipient failed:", error);
    return jsonError("An unexpected server error occurred while removing the recipient.", 500);
  }
}
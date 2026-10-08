import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error:"client_id is required" }, { status:400 });

  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error:"Client not found" }, { status:404 });

  const { data: projects } = await supabase
    .from("projects")
    .select("id,client_id,name,status,latest_update,next_step,deadline,completed_at,created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending:false });

  const { data: recipients } = await supabase
    .from("client_recipients")
    .select("id,client_id,name,email,is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);

  const safeProjects = projects ?? [];
  const safeRecipients = recipients ?? [];

  if (safeProjects.some(p => p.client_id !== clientId)) {
    return NextResponse.json({ error:"Client mismatch detected in projects. Preview blocked." }, { status:409 });
  }
  if (safeRecipients.some(r => r.client_id !== clientId)) {
    return NextResponse.json({ error:"Client mismatch detected in recipients. Preview blocked." }, { status:409 });
  }

  return NextResponse.json({
    client,
    projects:safeProjects,
    recipients:safeRecipients,
    summary:{
      total:safeProjects.length,
      completed:safeProjects.filter(p=>p.status==="completed").length,
      in_progress:safeProjects.filter(p=>p.status==="in_progress").length,
      awaiting_feedback:safeProjects.filter(p=>p.status==="awaiting_feedback").length
    }
  });
}

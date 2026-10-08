import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const bodySchema = z.object({ client_id:z.string().uuid() });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error:"Invalid client id." }, { status:400 });

  const clientId = parsed.data.client_id;
  const supabase = createAdminClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error:"Client not found." }, { status:404 });

  const { data: projects } = await supabase
    .from("projects")
    .select("id,client_id,name,status,latest_update,next_step,deadline")
    .eq("client_id", clientId);

  const { data: recipients } = await supabase
    .from("client_recipients")
    .select("id,client_id,name,email,is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);

  const safeProjects = projects ?? [];
  const safeRecipients = recipients ?? [];

  if (!safeRecipients.length) {
    return NextResponse.json({ error:"No active recipients for this client." }, { status:400 });
  }

  if (safeProjects.some(p => p.client_id !== clientId)) {
    return NextResponse.json({ error:"Client mismatch detected in projects. Send blocked." }, { status:409 });
  }
  if (safeRecipients.some(r => r.client_id !== clientId)) {
    return NextResponse.json({ error:"Client mismatch detected in recipients. Send blocked." }, { status:409 });
  }

  const rows = safeProjects.map(p => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee">${p.name}</td>
      <td style="padding:10px;border-bottom:1px solid #eee">${p.status.replaceAll("_"," ")}</td>
      <td style="padding:10px;border-bottom:1px solid #eee">${p.latest_update ?? ""}</td>
      <td style="padding:10px;border-bottom:1px solid #eee">${p.next_step ?? ""}</td>
    </tr>`).join("");

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const result = await resend.emails.send({
    from: process.env.REPORT_FROM_EMAIL!,
    to: safeRecipients.map(r=>r.email),
    subject: `${client.name} Weekly Project Update`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111">
        <h2>${client.name} Weekly Project Update</h2>
        <p>Here is the current status of your projects.</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th align="left">Project</th><th align="left">Status</th><th align="left">Latest update</th><th align="left">Next step</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  });

  if (result.error) {
    return NextResponse.json({ error:result.error.message }, { status:500 });
  }

  await supabase.from("weekly_reports").insert({
    client_id:clientId,
    report_type:"client",
    period_start:new Date().toISOString().slice(0,10),
    period_end:new Date().toISOString().slice(0,10),
    recipient_count:safeRecipients.length,
    project_count:safeProjects.length,
    status:"sent",
    sent_at:new Date().toISOString()
  });

  return NextResponse.json({ ok:true, id:result.data?.id });
}

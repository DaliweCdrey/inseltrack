import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { ClientReportingSettings } from "@/components/client-reporting-settings";

export default async function ClientDetailPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) notFound();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();
  const { data: recipients } = auth.profile.role === "guest"
    ? { data: [] }
    : await supabase.from("client_recipients").select("*").eq("client_id", id).order("name");
  const { data: projects } = await supabase.from("projects").select("*").eq("client_id", id).order("created_at",{ascending:false});

  return (
    <>
      <Topbar title={client.name} subtitle="Client details" />
      <div className="content">
        <div className="page-intro"><div><h1>{client.name}</h1><p>{client.industry ?? "Client"} reporting and projects.</p></div></div>
        <div className="reports-grid">
          <section className="panel settings-card">
            <ClientReportingSettings
              clientId={client.id}
              reportingEnabled={client.reporting_enabled}
              reportingDay={client.reporting_day}
              reportingTime={client.reporting_time}
              recipients={(recipients ?? []).map((recipient:any) => ({ id: recipient.id, name: recipient.name, email: recipient.email, is_active: recipient.is_active }))}
              canManage={auth.profile.role === "admin"}
              isGuest={auth.profile.role === "guest"}
            />
            <a className="btn lime" href={`/reports?client=${client.id}`}>Preview report</a>
          </section>
          <section className="panel table-wrap">
            <div className="table-heading"><div><h3>Projects</h3><p>{projects?.length ?? 0} records</p></div></div>
            <table><thead><tr><th>Project</th><th>Status</th><th>Deadline</th></tr></thead>
              <tbody>{(projects??[]).map((p:any)=><tr key={p.id}><td><a href={`/projects/${p.id}`}>{p.name}</a></td><td>{p.status}</td><td>{p.deadline ?? "No deadline"}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}

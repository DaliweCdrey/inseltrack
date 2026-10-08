import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("*, client_recipients(count), projects(count)").order("name");

  return (
    <>
      <Topbar title="Clients" subtitle="Client records and reporting" />
      <div className="content">
        <div className="page-intro"><div><h1>Clients</h1><p>Manage project ownership, recipients and client reporting.</p></div></div>
        <div className="card-grid">
          {(clients ?? []).map((c:any)=>(
            <Link className="panel client-card clickable" href={`/clients/${c.id}`} key={c.id}>
              <div className="client-top"><div className="client-logo">{c.name[0]}</div><span className={`badge ${c.reporting_enabled?"b-complete":"b-hold"}`}>{c.reporting_enabled?"Reporting on":"Manual"}</span></div>
              <h3>{c.name}</h3><p>{c.industry ?? "Client"}</p>
              <div className="client-stats">
                <div className="client-stat"><strong>{c.projects?.[0]?.count ?? 0}</strong><span>Projects</span></div>
                <div className="client-stat"><strong>{c.client_recipients?.[0]?.count ?? 0}</strong><span>Recipients</span></div>
                <div className="client-stat"><strong>{c.reporting_enabled?"ON":"OFF"}</strong><span>Weekly report</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

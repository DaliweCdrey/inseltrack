import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

const label: Record<string,string> = {
  not_started:"Not Started",
  in_progress:"In Progress",
  awaiting_feedback:"Awaiting Feedback",
  completed:"Completed",
  on_hold:"On Hold"
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{status?:string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("projects").select("*, clients(name), project_internal_details(priority,assigned_to)").order("created_at", { ascending:false });

  if (params.status) query = query.eq("status", params.status);

  const { data: projects } = await query;

  return (
    <>
      <Topbar title="Projects" subtitle="All work across clients" />
      <div className="content">
        <div className="page-intro">
          <div><h1>Projects</h1><p>Open, review and manage every project in the system.</p></div>
          <Link className="btn lime" href="/projects/new">+ New project</Link>
        </div>

        <section className="panel table-wrap">
          <div className="table-heading"><div><h3>All projects</h3><p>{projects?.length ?? 0} projects</p></div></div>
          <table>
            <thead><tr><th>Project</th><th>Client</th><th>Assigned to</th><th>Deadline</th><th>Status</th></tr></thead>
            <tbody>
              {(projects ?? []).map((p:any)=>(
                <tr key={p.id}>
                  <td><Link href={`/projects/${p.id}`}><span className="project-name">{p.name}</span><span className="sub">{p.project_internal_details?.priority ?? ""}</span></Link></td>
                  <td>{p.clients?.name ?? "No client"}</td>
                  <td>{p.project_internal_details?.assigned_to ?? "Unassigned"}</td>
                  <td>{p.deadline ?? "No deadline"}</td>
                  <td><span className={`badge ${p.status==="completed"?"b-complete":p.status==="awaiting_feedback"?"b-feedback":"b-progress"}`}>{label[p.status] ?? p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

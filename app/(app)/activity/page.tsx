import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

export default async function ActivityPage(){
  const supabase=await createClient();
  const {data}=await supabase.from("project_activities").select("*, projects(name)").order("created_at",{ascending:false}).limit(50);
  return <><Topbar title="Activity" subtitle="Recent project movement"/><div className="content"><div className="page-intro"><div><h1>Activity</h1><p>Project changes logged by the system.</p></div></div><section className="panel activity-panel"><div className="activity-list">{(data??[]).map((a:any)=><div className="activity-item" key={a.id}><div className="activity-icon">A</div><div><strong>{a.projects?.name ?? "Project"}</strong><span>{a.action}: {a.old_value ?? ""} {a.old_value ? "to" : ""} {a.new_value ?? ""}</span></div><time>{new Date(a.created_at).toLocaleString()}</time></div>)}</div></section></div></>
}

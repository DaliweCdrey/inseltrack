"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ProjectEditor({ project, details, clients, canChangeClient, canDelete }: { project:any; details:any; clients:{id:string;name:string}[]; canChangeClient:boolean; canDelete:boolean }) {
  const router = useRouter();
  const [message,setMessage] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const status = String(data.get("status"));
    const supabase = createClient();

    const payload:any = {
      name:String(data.get("name")),
      deadline:String(data.get("deadline") || "") || null,
      status,
      latest_update:String(data.get("latest_update") || ""),
      next_step:String(data.get("next_step") || ""),
      updated_at:new Date().toISOString(),
      completed_at: status === "completed" ? (project.completed_at ?? new Date().toISOString()) : null
    };
    if (canChangeClient) payload.client_id = String(data.get("client_id"));

    const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const { error: detailsError } = await supabase.from("project_internal_details").upsert({
      project_id:project.id,
      assigned_to:String(data.get("assigned_to") || ""),
      priority:String(data.get("priority")),
      internal_notes:String(data.get("internal_notes") || "")
    });
    setMessage(detailsError ? `Project updated, but internal details could not be saved: ${detailsError.message}` : "Project updated.");
    if (!detailsError) router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this project?")) return;
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", project.id);
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <div className="field"><label>Project name</label><input name="name" defaultValue={project.name} /></div>
      <div className="field"><label>Client</label><select name="client_id" defaultValue={project.client_id} disabled={!canChangeClient}>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Assigned to</label><input name="assigned_to" defaultValue={details?.assigned_to ?? ""} /></div>
      <div className="field"><label>Deadline</label><input type="date" name="deadline" defaultValue={project.deadline ?? ""} /></div>
      <div className="field"><label>Status</label><select name="status" defaultValue={project.status}><option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="awaiting_feedback">Awaiting Feedback</option><option value="completed">Completed</option><option value="on_hold">On Hold</option></select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={details?.priority ?? "normal"}><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      <div className="field"><label>Latest client-safe update</label><input name="latest_update" defaultValue={project.latest_update ?? ""} /></div>
      <div className="field"><label>Next step</label><input name="next_step" defaultValue={project.next_step ?? ""} /></div>
      <div className="field"><label>Internal notes</label><textarea name="internal_notes" rows={5} defaultValue={details?.internal_notes ?? ""} /></div>
      {message && <p>{message}</p>}
      <button className="btn lime">Save changes</button>
      {canDelete && <button type="button" className="btn" onClick={remove} style={{marginLeft:8}}>Delete project</button>}
    </form>
  );
}

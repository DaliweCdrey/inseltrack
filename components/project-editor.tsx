"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ProjectEditor({ project, clients }: { project:any; clients:{id:string;name:string}[] }) {
  const router = useRouter();
  const [message,setMessage] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const status = String(data.get("status"));
    const supabase = createClient();

    const payload:any = {
      name:String(data.get("name")),
      client_id:String(data.get("client_id")),
      assigned_to:String(data.get("assigned_to") || ""),
      deadline:String(data.get("deadline") || "") || null,
      status,
      priority:String(data.get("priority")),
      latest_update:String(data.get("latest_update") || ""),
      next_step:String(data.get("next_step") || ""),
      description:String(data.get("description") || ""),
      updated_at:new Date().toISOString(),
      completed_at: status === "completed" ? (project.completed_at ?? new Date().toISOString()) : null
    };

    const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
    setMessage(error ? error.message : "Project updated.");
    if (!error) router.refresh();
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
      <div className="field"><label>Client</label><select name="client_id" defaultValue={project.client_id}>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Assigned to</label><input name="assigned_to" defaultValue={project.assigned_to ?? ""} /></div>
      <div className="field"><label>Deadline</label><input type="date" name="deadline" defaultValue={project.deadline ?? ""} /></div>
      <div className="field"><label>Status</label><select name="status" defaultValue={project.status}><option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="awaiting_feedback">Awaiting Feedback</option><option value="completed">Completed</option><option value="on_hold">On Hold</option></select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={project.priority}><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      <div className="field"><label>Latest client-safe update</label><input name="latest_update" defaultValue={project.latest_update ?? ""} /></div>
      <div className="field"><label>Next step</label><input name="next_step" defaultValue={project.next_step ?? ""} /></div>
      <div className="field"><label>Description / internal notes</label><textarea name="description" rows={5} defaultValue={project.description ?? ""} /></div>
      {message && <p>{message}</p>}
      <button className="btn lime">Save changes</button>
      <button type="button" className="btn" onClick={remove} style={{marginLeft:8}}>Delete project</button>
    </form>
  );
}

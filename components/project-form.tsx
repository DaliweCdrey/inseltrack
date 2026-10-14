"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProjectForm({ clients }: { clients: {id:string;name:string}[] }) {
  const router = useRouter();
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const supabase = createClient();
    const payload = {
      name:String(data.get("name")),
      client_id:String(data.get("client_id")),
      deadline:String(data.get("deadline") || "") || null,
      status:String(data.get("status")),
      latest_update:null,
      next_step:null
    };

    const { data: project, error } = await supabase.from("projects").insert(payload).select("id").single();
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    const { error: detailsError } = await supabase.from("project_internal_details").insert({
      project_id:project.id,
      requested_by:String(data.get("requested_by") || ""),
      assigned_to:String(data.get("assigned_to") || ""),
      priority:String(data.get("priority")),
      internal_notes:String(data.get("description") || "")
    });
    if (detailsError) {
      setError(`Project created, but internal details could not be saved: ${detailsError.message}`);
      setSaving(false);
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="field"><label>Project name</label><input name="name" required /></div>
      <div className="field"><label>Client</label><select name="client_id" required>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label>Requested by</label><input name="requested_by" /></div>
      <div className="field"><label>Assigned to</label><input name="assigned_to" /></div>
      <div className="field"><label>Deadline</label><input name="deadline" type="date" /></div>
      <div className="field"><label>Status</label><select name="status"><option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="awaiting_feedback">Awaiting Feedback</option><option value="completed">Completed</option><option value="on_hold">On Hold</option></select></div>
      <div className="field"><label>Priority</label><select name="priority"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      <div className="field"><label>Internal notes</label><textarea name="description" rows={5} /></div>
      {error && <p style={{color:"#B84343"}}>{error}</p>}
      <button className="btn lime" disabled={saving}>{saving?"Saving...":"Create project"}</button>
    </form>
  );
}

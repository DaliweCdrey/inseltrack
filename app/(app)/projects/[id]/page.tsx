import { notFound } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditor } from "@/components/project-editor";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function ProjectDetailPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*, clients(id,name)").eq("id", id).single();
  if (!project) notFound();
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at) notFound();

  if (auth.profile.role === "guest") {
    return (
      <>
        <Topbar title={project.name} subtitle="Project details" />
        <div className="content">
          <div className="page-intro"><div><h1>{project.name}</h1><p>{project.clients?.name ?? "Your client"}</p></div></div>
          <section className="panel settings-card">
            <p><strong>Status:</strong> {project.status.replaceAll("_", " ")}</p>
            <p><strong>Deadline:</strong> {project.deadline ?? "No deadline"}</p>
            <p><strong>Latest update:</strong> {project.latest_update ?? "No update yet."}</p>
            <p><strong>Next step:</strong> {project.next_step ?? "Not specified."}</p>
            {project.completed_at && <p><strong>Completed:</strong> {project.completed_at}</p>}
          </section>
        </div>
      </>
    );
  }

  const [{ data: clients }, { data: details }] = await Promise.all([
    supabase.from("clients").select("id,name").order("name"),
    supabase.from("project_internal_details").select("*").eq("project_id", id).maybeSingle()
  ]);

  return (
    <>
      <Topbar title={project.name} subtitle="Project details" />
      <div className="content">
        <div className="page-intro"><div><h1>{project.name}</h1><p>Update status, assignment, deadline and client-facing notes.</p></div></div>
        <section className="panel settings-card">
          <ProjectEditor project={project} details={details} clients={clients ?? []} canChangeClient={auth.profile.role === "admin"} canDelete={auth.profile.role === "admin"} />
        </section>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditor } from "@/components/project-editor";

export default async function ProjectDetailPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*, clients(id,name)").eq("id", id).single();
  const { data: clients } = await supabase.from("clients").select("id,name").order("name");
  if (!project) notFound();

  return (
    <>
      <Topbar title={project.name} subtitle="Project details" />
      <div className="content">
        <div className="page-intro"><div><h1>{project.name}</h1><p>Update status, assignment, deadline and client-facing notes.</p></div></div>
        <section className="panel settings-card">
          <ProjectEditor project={project} clients={clients ?? []} />
        </section>
      </div>
    </>
  );
}

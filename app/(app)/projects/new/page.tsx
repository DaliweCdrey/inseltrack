import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id,name").eq("is_active", true).order("name");
  return (
    <>
      <Topbar title="New project" subtitle="Create and assign a project" />
      <div className="content">
        <div className="page-intro"><div><h1>Add project</h1><p>Create a project and link it to the right client from the start.</p></div></div>
        <section className="panel settings-card">
          <ProjectForm clients={clients ?? []} />
        </section>
      </div>
    </>
  );
}

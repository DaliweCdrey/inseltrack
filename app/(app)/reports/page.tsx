import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { ReportPreview } from "@/components/report-preview";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{client?:string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id,name,reporting_enabled").eq("is_active", true).order("name");
  const initialClientId = params.client ?? clients?.[0]?.id ?? "";

  return (
    <>
      <Topbar title="Reports" subtitle="Weekly internal and client updates" />
      <div className="content">
        <div className="page-intro"><div><h1>Weekly reports</h1><p>Preview exactly what a client will receive before sending it.</p></div></div>
        <ReportPreview clients={clients ?? []} initialClientId={initialClientId} />
      </div>
    </>
  );
}

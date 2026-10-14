import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";
import { ReportPreview } from "@/components/report-preview";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getNextScheduledSend } from "@/lib/reports/service";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{client?:string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const auth = await getCurrentProfile();
  const { data: clients } = await supabase.from("clients").select("id,name,reporting_enabled,reporting_day,reporting_time").eq("is_active", true).order("name");
  const { data: histories } = await supabase.from("weekly_reports")
    .select("client_id,status,sent_at,period_start,period_end,created_at")
    .eq("report_type", "client")
    .order("created_at", { ascending: false });
  const latestByClient = new Map<string, NonNullable<typeof histories>[number]>();
  const lastSentByClient = new Map<string, string>();
  for (const history of histories ?? []) {
    if (!history.client_id) continue;
    if (!latestByClient.has(history.client_id)) latestByClient.set(history.client_id, history);
    if (history.sent_at && !lastSentByClient.has(history.client_id)) lastSentByClient.set(history.client_id, history.sent_at);
  }
  const reportClients = (clients ?? []).map(client => {
    const last = latestByClient.get(client.id);
    return {
      ...client,
      nextScheduledAt: client.reporting_enabled ? getNextScheduledSend(client.reporting_day, client.reporting_time) : null,
      lastReportStatus: last?.status ?? null,
      lastSentAt: lastSentByClient.get(client.id) ?? null
    };
  });
  const initialClientId = params.client ?? reportClients[0]?.id ?? "";

  return (
    <>
      <Topbar title="Reports" subtitle="Weekly internal and client updates" />
      <div className="content">
        <div className="page-intro"><div><h1>Weekly reports</h1><p>Preview exactly what a client will receive before sending it.</p></div></div>
        <ReportPreview clients={reportClients} initialClientId={initialClientId} canSend={auth?.profile.role === "admin" || auth?.profile.role === "user"} isAdmin={auth?.profile.role === "admin"} isGuest={auth?.profile.role === "guest"} />
      </div>
    </>
  );
}

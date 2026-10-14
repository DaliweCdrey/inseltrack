import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { UserAccessManager } from "@/components/user-access-manager";
import { getCurrentProfile, getAccountStatus } from "@/lib/auth/profile";

export default async function UsersPage() {
  const auth = await getCurrentProfile();
  if (!auth?.profile.approved || !auth.profile.is_active || auth.profile.rejected_at || auth.profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: profiles, error }, { data: clients, error: clientsError }] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id,full_name,email,role,client_id,approved,is_active,rejected_at,created_at,clients(name)")
      .order("created_at", { ascending: false }),
    auth.supabase
      .from("clients")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
  ]);

  if (error || clientsError) {
    return <><Topbar title="Users & Access" subtitle="Manage InselTrack accounts" /><div className="content"><section className="panel settings-card"><p>Unable to load user access data. Refresh the page or contact support.</p></section></div></>;
  }

  const users = (profiles ?? []).map((profile: any) => ({
    ...profile,
    status: getAccountStatus(profile)
  }));
  const summary = {
    pending: users.filter((user: any) => user.status === "pending").length,
    staff: users.filter((user: any) => user.status === "approved" && user.role !== "guest").length,
    clients: users.filter((user: any) => user.status === "approved" && user.role === "guest").length,
    disabled: users.filter((user: any) => user.status === "disabled").length
  };

  return (
    <>
      <Topbar title="Users & Access" subtitle="Review account requests and manage access" />
      <div className="content">
        <div className="page-intro"><div><h1>Users & Access</h1><p>Approve accounts, assign client access and manage internal permissions.</p></div></div>
        <div className="card-grid user-summary-grid">
          <SummaryCard label="Pending approvals" count={summary.pending} />
          <SummaryCard label="Approved staff" count={summary.staff} />
          <SummaryCard label="Approved clients" count={summary.clients} />
          <SummaryCard label="Disabled accounts" count={summary.disabled} />
        </div>
        <UserAccessManager users={users} clients={clients ?? []} />
      </div>
    </>
  );
}

function SummaryCard({ label, count }: { label: string; count: number }) {
  return <section className="panel user-summary-card"><span>{label}</span><strong>{count}</strong></section>;
}

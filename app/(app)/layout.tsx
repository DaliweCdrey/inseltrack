import { Sidebar } from "@/components/sidebar";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentProfile();
  return (
    <div className="app-shell">
      <Sidebar role={auth?.profile.role ?? null} fullName={auth?.profile.full_name ?? ""} email={auth?.profile.email ?? auth?.user.email ?? null} />
      <section className="main">{children}</section>
    </div>
  );
}

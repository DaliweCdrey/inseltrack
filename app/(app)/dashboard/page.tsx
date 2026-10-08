import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { count: total } = await supabase.from("projects").select("*", { count: "exact", head: true });
  const { count: completed } = await supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "completed");
  const { count: waiting } = await supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "awaiting_feedback");

  const totalCount = total ?? 0;
  const completedCount = completed ?? 0;
  const waitingCount = waiting ?? 0;
  const openCount = Math.max(totalCount - completedCount, 0);
  const rate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <Topbar title="Dashboard" subtitle="Weekly project overview" />
      <div className="content">
        <div className="page-intro">
          <div>
            <h1>Hello, Rowland</h1>
            <p>See what came in this week, what moved, what is still open and what needs attention before the weekly reports go out.</p>
          </div>
          <div className="intro-actions">
            <Link className="btn" href="/activity">View activity</Link>
            <Link className="btn lime" href="/projects/new">Add project</Link>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="panel summary-card">
            <div className="eyebrow">Projects tracked</div>
            <div className="big-number">{totalCount}</div>
            <div className="summary-copy">All current project records in InselTrack.</div>
            <div style={{height:24}} />
            <div className="progress-label"><span>Completion rate</span><strong>{rate}%</strong></div>
            <div className="progress"><div style={{width:`${rate}%`}} /></div>
            <div className="stat-list">
              <Link href="/projects?status=completed" className="stat-item"><div><strong>{completedCount}</strong><span>Completed</span></div><div className="meta">View</div></Link>
              <Link href="/projects" className="stat-item"><div><strong>{openCount}</strong><span>Still open</span></div><div className="meta">Open</div></Link>
              <Link href="/projects?status=awaiting_feedback" className="stat-item highlight"><div><strong>{waitingCount}</strong><span>Awaiting feedback</span></div><div className="meta">Check</div></Link>
            </div>
          </section>

          <div className="mid-column">
            <section className="panel">
              <div className="panel-head"><div><h3>Client workload</h3><p>Open work currently moving through the team.</p></div></div>
              <div className="client-workload">
                <Link className="workload-row dark" href="/clients"><div className="workload-logo">E</div><div><strong>Ecobank</strong><small>Open client record</small></div><div className="right">Open</div></Link>
                <Link className="workload-row lime" href="/clients"><div className="workload-logo">S</div><div><strong>Shell</strong><small>Open client record</small></div><div className="right">Review</div></Link>
                <Link className="workload-row" href="/clients"><div className="workload-logo">U</div><div><strong>Uganda Airlines</strong><small>Open client record</small></div><div className="right">Open</div></Link>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><div><h3>Reporting</h3><p>Preview client and internal weekly reports.</p></div></div>
              <div style={{padding:"0 22px 22px"}}>
                <Link className="btn lime" href="/reports">Open reports</Link>
              </div>
            </section>
          </div>

          <section className="panel activity-panel">
            <div className="panel-head"><div><h3>Recent activity</h3><p>Latest changes logged by the system.</p></div></div>
            <div className="activity-list">
              <div className="activity-item"><div className="activity-icon">A</div><div><strong>Activity log</strong><span>Project history will appear here as work changes.</span></div><time>Live</time></div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

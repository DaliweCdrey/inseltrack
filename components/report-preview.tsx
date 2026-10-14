"use client";

import { useEffect, useState } from "react";

type ReportClient = {
  id: string;
  name: string;
  reporting_enabled: boolean;
  reporting_day: string;
  reporting_time: string;
  nextScheduledAt: string | null;
  lastReportStatus: string | null;
  lastSentAt: string | null;
};

export function ReportPreview({ clients, initialClientId, canSend, isAdmin, isGuest }: { clients:ReportClient[]; initialClientId:string; canSend:boolean; isAdmin:boolean; isGuest:boolean }) {
  const [clientId,setClientId] = useState(initialClientId);
  const [report,setReport] = useState<any>(null);
  const [message,setMessage] = useState("");
  const [messageIsError,setMessageIsError] = useState(false);
  const [loading,setLoading] = useState(false);
  const [sending,setSending] = useState(false);
  const [force,setForce] = useState(false);

  async function load(id:string) {
    if (!id) return;
    setClientId(id);
    setMessage("");
    setForce(false);
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(`/api/reports/preview?client_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the report preview.");
      setReport(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the report preview.");
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ if(initialClientId) load(initialClientId); },[initialClientId]);

  async function send() {
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/reports/send", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({client_id:clientId,force})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send report.");
      setMessage(`Report sent for ${data.period.period_start} to ${data.period.period_end}.`);
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send report.");
      setMessageIsError(true);
    } finally {
      setSending(false);
    }
  }

  const dateLabel = (value: string | null | undefined) => {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="reports-grid">
      <aside className="panel report-list">
        <div className="report-list-head"><h3>Report queue</h3><p>Select a client</p></div>
        {clients.map(c=>(
          <button key={c.id} className={`report-item ${clientId===c.id?"active":""}`} style={{width:"100%",textAlign:"left",borderRight:0,borderBottom:0}} onClick={()=>load(c.id)}>
            <strong>{c.name}</strong><span>{c.reporting_enabled?"Automatic reporting enabled":"Automatic reporting disabled"}</span>
            <small>Next scheduled send: {c.nextScheduledAt ? dateLabel(c.nextScheduledAt) : "—"}</small>
            <small>Last sent: {dateLabel(c.lastSentAt)} · Last status: {c.lastReportStatus ?? "No reports"}</small>
          </button>
        ))}
      </aside>

      <section className="panel email-preview">
        <div className="email-head">
          <div>
            <h3>{report?.client?.name ?? "Select a client"} Weekly Project Update</h3>
            <p>Reporting period: {report ? `${report.period.period_start} to ${report.period.period_end}` : "—"}</p>
            {isAdmin && <label className="force-report"><input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} /> Force resend for this period</label>}
          </div>
          {canSend && <button className="btn dark" disabled={!report || loading || sending} onClick={send}>{sending ? "Sending…" : force ? "Force resend" : "Send report"}</button>}
        </div>
        <div className="email-body">
          {loading ? <p>Loading report preview…</p> : report ? <>
            <p><strong>{report.projects.length}</strong> projects included in this client-scoped report.</p>
            {!isGuest && <div className="report-recipients"><strong>Recipients</strong>{report.recipients.length ? <ul>{report.recipients.map((recipient:any)=><li key={recipient.id}>{recipient.name} · {recipient.email}</li>)}</ul> : <p>No active recipients configured.</p>}</div>}
            <div className="summary-row report-summary">
              <div className="summary-box"><strong>{report.summary.total_active}</strong><span>Active projects</span></div>
              <div className="summary-box"><strong>{report.summary.completed_this_period}</strong><span>Completed this period</span></div>
              <div className="summary-box"><strong>{report.summary.in_progress}</strong><span>In progress</span></div>
              <div className="summary-box"><strong>{report.summary.awaiting_feedback}</strong><span>Awaiting feedback</span></div>
              <div className="summary-box"><strong>{report.summary.overdue}</strong><span>Overdue</span></div>
            </div>
            <table>
              <thead><tr><th>Project</th><th>Status</th><th>Latest update</th><th>Next step</th><th>Deadline</th></tr></thead>
              <tbody>{report.projects.map((p:any)=><tr key={p.id}><td>{p.name}</td><td>{p.status.replaceAll("_"," ")}</td><td>{p.latest_update ?? "—"}</td><td>{p.next_step ?? "—"}</td><td>{p.deadline ?? "—"}</td></tr>)}</tbody>
            </table>
            {!isGuest && <div className="safe-note">Client check passed. Every included project and active recipient belongs to {report.client.name}.</div>}
          </> : <p>{clients.length ? "Select a client to preview its report." : "No client reports are available for this account."}</p>}
          {message && <p className={messageIsError ? "report-message error" : "report-message"} role="status">{message}</p>}
        </div>
      </section>
    </div>
  );
}

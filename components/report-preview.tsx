"use client";

import { useEffect, useState } from "react";

export function ReportPreview({ clients, initialClientId }: { clients:any[]; initialClientId:string }) {
  const [clientId,setClientId] = useState(initialClientId);
  const [report,setReport] = useState<any>(null);
  const [message,setMessage] = useState("");

  async function load(id:string) {
    if (!id) return;
    setClientId(id);
    setMessage("");
    const res = await fetch(`/api/reports/preview?client_id=${id}`);
    const data = await res.json();
    setReport(data);
  }

  useEffect(()=>{ if(initialClientId) load(initialClientId); },[initialClientId]);

  async function send() {
    const res = await fetch("/api/reports/send", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({client_id:clientId})
    });
    const data = await res.json();
    setMessage(res.ok ? "Report sent." : (data.error ?? "Could not send report."));
  }

  return (
    <div className="reports-grid">
      <aside className="panel report-list">
        <div className="report-list-head"><h3>Report queue</h3><p>Select a client</p></div>
        {clients.map(c=>(
          <button key={c.id} className={`report-item ${clientId===c.id?"active":""}`} style={{width:"100%",textAlign:"left",borderRight:0,borderBottom:0}} onClick={()=>load(c.id)}>
            <strong>{c.name}</strong><span>{c.reporting_enabled?"Reporting enabled":"Manual reporting"}</span>
          </button>
        ))}
      </aside>

      <section className="panel email-preview">
        <div className="email-head">
          <div>
            <h3>{report?.client?.name ?? "Select a client"} Weekly Project Update</h3>
            <p>{report?.recipients?.length ? `To: ${report.recipients.map((r:any)=>r.email).join(", ")}` : "No recipients loaded"}</p>
          </div>
          <button className="btn dark" disabled={!report} onClick={send}>Send report</button>
        </div>
        <div className="email-body">
          {report ? <>
            <div className="summary-row">
              <div className="summary-box"><strong>{report.summary.total}</strong><span>Total projects</span></div>
              <div className="summary-box"><strong>{report.summary.completed}</strong><span>Completed</span></div>
              <div className="summary-box"><strong>{report.summary.in_progress}</strong><span>In progress</span></div>
              <div className="summary-box"><strong>{report.summary.awaiting_feedback}</strong><span>Awaiting feedback</span></div>
            </div>
            <table>
              <thead><tr><th>Project</th><th>Status</th><th>Latest update</th><th>Next step</th></tr></thead>
              <tbody>{report.projects.map((p:any)=><tr key={p.id}><td>{p.name}</td><td>{p.status}</td><td>{p.latest_update ?? ""}</td><td>{p.next_step ?? ""}</td></tr>)}</tbody>
            </table>
            <div className="safe-note">Client check passed. Every project and recipient in this preview belongs to {report.client.name}.</div>
            {message && <p>{message}</p>}
          </> : <p>Select a client to preview its report.</p>}
        </div>
      </section>
    </div>
  );
}

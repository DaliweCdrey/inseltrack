import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ReportPeriod = { period_start: string; period_end: string };
export type ClientReportProject = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  latest_update: string | null;
  next_step: string | null;
  deadline: string | null;
  completed_at: string | null;
};
export type ClientReportRecipient = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  is_active: boolean;
};
export type ClientReportData = {
  client: { id: string; name: string };
  period: ReportPeriod;
  projects: ClientReportProject[];
  recipients: ClientReportRecipient[];
  summary: {
    total_active: number;
    completed_this_period: number;
    in_progress: number;
    awaiting_feedback: number;
    overdue: number;
  };
};

export class ReportScopeError extends Error {}

export function getCurrentReportingPeriod(now = new Date()): ReportPeriod {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = today.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { period_start: monday.toISOString().slice(0, 10), period_end: friday.toISOString().slice(0, 10) };
}

export function getNextScheduledSend(day: string, time: string, now = new Date()) {
  const dayIndex = WEEKDAYS.indexOf(day);
  const [hours, minutes] = time.split(":").map(Number);
  if (dayIndex < 0 || !Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes));
  const daysUntil = (dayIndex - now.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + daysUntil);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}

export function isClientDue(client: { reporting_day: string; reporting_time: string }, now = new Date()) {
  if (WEEKDAYS[now.getUTCDay()] !== client.reporting_day) return false;
  const [hours, minutes] = client.reporting_time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  return now.getUTCHours() * 60 + now.getUTCMinutes() >= hours * 60 + minutes;
}

export async function buildClientReport(clientId: string, period = getCurrentReportingPeriod()): Promise<ClientReportData> {
  const supabase = createAdminClient();
  const [{ data: client, error: clientError }, { data: projects, error: projectsError }, { data: recipients, error: recipientsError }] = await Promise.all([
    supabase.from("clients").select("id,name,is_active").eq("id", clientId).single(),
    supabase.from("projects").select("id,client_id,name,status,latest_update,next_step,deadline,completed_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("client_recipients").select("id,client_id,name,email,is_active").eq("client_id", clientId).eq("is_active", true).order("name")
  ]);

  if (clientError || !client) throw new Error("Could not load the requested client.");
  if (!client.is_active) throw new Error("Reports cannot be sent for an inactive client.");
  if (projectsError || recipientsError) throw new Error("Could not load report data.");

  const safeProjects = (projects ?? []) as ClientReportProject[];
  const safeRecipients = (recipients ?? []) as ClientReportRecipient[];
  if (safeProjects.some(project => project.client_id !== clientId)) {
    throw new ReportScopeError("Client mismatch detected in projects. Report generation blocked.");
  }
  if (safeRecipients.some(recipient => recipient.client_id !== clientId)) {
    throw new ReportScopeError("Client mismatch detected in recipients. Report generation blocked.");
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    client: { id: client.id, name: client.name },
    period,
    projects: safeProjects,
    recipients: safeRecipients,
    summary: {
      total_active: safeProjects.filter(project => project.status !== "completed").length,
      completed_this_period: safeProjects.filter(project => {
        if (project.status !== "completed" || !project.completed_at) return false;
        const completedDate = project.completed_at.slice(0, 10);
        return completedDate >= period.period_start && completedDate <= period.period_end;
      }).length,
      in_progress: safeProjects.filter(project => project.status === "in_progress").length,
      awaiting_feedback: safeProjects.filter(project => project.status === "awaiting_feedback").length,
      overdue: safeProjects.filter(project => project.status !== "completed" && project.deadline && project.deadline < today).length
    }
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

function buildEmail(report: ClientReportData) {
  const rows = report.projects.map(project => `<tr>
    <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(project.name)}</td>
    <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(project.status.replaceAll("_", " "))}</td>
    <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(project.latest_update ?? "—")}</td>
    <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(project.next_step ?? "—")}</td>
    <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(project.deadline ?? "—")}</td>
  </tr>`).join("");
  const summaryRows = [
    ["Total active projects", report.summary.total_active],
    ["Completed this period", report.summary.completed_this_period],
    ["In progress", report.summary.in_progress],
    ["Awaiting feedback", report.summary.awaiting_feedback],
    ["Overdue", report.summary.overdue]
  ].map(([label, value]) => `<li>${label}: <strong>${value}</strong></li>`).join("");
  return {
    subject: `Weekly Project Update | Insel Communications | ${report.client.name}`,
    html: `<div style="max-width:900px;margin:0 auto;font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <p>Hello,</p><p>Please find below your weekly project update from Insel Communications.</p>
      <p><strong>Reporting period:</strong> ${report.period.period_start} to ${report.period.period_end}</p>
      <h2 style="font-size:20px">Summary</h2><ul>${summaryRows}</ul>
      <h2 style="font-size:20px">Projects</h2>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left">
        <thead><tr>${["Project", "Status", "Latest Update", "Next Step", "Deadline"].map(label => `<th style="padding:10px;border-bottom:2px solid #d1d5db">${label}</th>`).join("")}</tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="padding:12px">No projects are currently available for this client.</td></tr>`}</tbody>
      </table></div>
      <footer style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px">Insel Communications<br/>Powered by InselTrack</footer>
    </div>`
  };
}

async function insertFailedReport(report: ClientReportData, source: "manual" | "scheduled", errorMessage: string) {
  const supabase = createAdminClient();
  await supabase.from("weekly_reports").insert({
    client_id: report.client.id,
    report_type: "client",
    period_start: report.period.period_start,
    period_end: report.period.period_end,
    recipient_count: report.recipients.length,
    project_count: report.projects.length,
    recipient_snapshot: report.recipients.map(({ id, name, email }) => ({ recipient_id: id, name, email })),
    status: "failed",
    send_state: "failed",
    send_source: source,
    send_error: errorMessage.slice(0, 1000)
  });
}

export async function sendClientReport(clientId: string, source: "manual" | "scheduled", period = getCurrentReportingPeriod(), force = false) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase.from("weekly_reports")
    .select("id,send_state").eq("client_id", clientId).eq("report_type", "client")
    .eq("period_start", period.period_start).eq("period_end", period.period_end)
    .in("send_state", ["sending", "sent"]).limit(1);
  if (existingError) {
    console.error("Prior report history lookup failed:", {
      code: existingError.code,
      message: existingError.message,
      details: existingError.details,
      hint: existingError.hint
    });
    throw new Error("Could not verify prior report history.");
  }
  if (existing?.some(report => report.send_state === "sending")) {
    return { ok: false as const, duplicate: true, error: "A report for this client and reporting period is currently sending." };
  }
  const supersedingSent = existing?.some(report => report.send_state === "sent") ?? false;
  if (supersedingSent) {
    if (!force) return { ok: false as const, duplicate: true, error: "A report for this client and reporting period has already been sent." };
  }

  let report: ClientReportData;
  try {
    report = await buildClientReport(clientId, period);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate report data.";
    await supabase.from("weekly_reports").insert({
      client_id: clientId,
      report_type: "client",
      period_start: period.period_start,
      period_end: period.period_end,
      recipient_count: 0,
      project_count: 0,
      status: "failed",
      send_state: "failed",
      send_source: source,
      send_error: message.slice(0, 1000)
    });
    throw error;
  }

  const missingConfig = ["RESEND_API_KEY", "REPORT_FROM_EMAIL"].filter(name => !process.env[name]);
  if (missingConfig.length) {
    const message = `Report sending is not configured. Missing environment variable${missingConfig.length > 1 ? "s" : ""}: ${missingConfig.join(", ")}.`;
    await insertFailedReport(report, source, message);
    return { ok: false as const, duplicate: false, error: message };
  }
  if (!report.recipients.length) {
    const message = "No active recipients are configured for this client.";
    await insertFailedReport(report, source, message);
    return { ok: false as const, duplicate: false, error: message };
  }

  if (supersedingSent) {
    const { error: supersedeError } = await supabase.from("weekly_reports").update({ send_state: "superseded" })
      .eq("client_id", clientId).eq("report_type", "client")
      .eq("period_start", period.period_start).eq("period_end", period.period_end).eq("send_state", "sent");
    if (supersedeError) throw new Error("Could not reserve a forced resend. No email was sent.");
  }

  const recipientSnapshot = report.recipients.map(({ id, name, email }) => ({ recipient_id: id, name, email }));
  const { data: history, error: historyError } = await supabase.from("weekly_reports").insert({
    client_id: clientId,
    report_type: "client",
    period_start: period.period_start,
    period_end: period.period_end,
    recipient_count: report.recipients.length,
    project_count: report.projects.length,
    recipient_snapshot: recipientSnapshot,
    status: "draft",
    send_state: "sending",
    send_source: source
  }).select("id").single();
  if (historyError || !history) {
    if (historyError?.code === "23505") return { ok: false as const, duplicate: true, error: "A report for this client and reporting period has already been sent or is currently sending." };
    if (supersedingSent) await supabase.from("weekly_reports").update({ send_state: "sent" })
      .eq("client_id", clientId).eq("report_type", "client")
      .eq("period_start", period.period_start).eq("period_end", period.period_end).eq("send_state", "superseded");
    throw new Error("Could not reserve a report history record. No email was sent.");
  }

  const { error: snapshotError } = await supabase.from("weekly_report_projects").insert(report.projects.map(project => ({
    report_id: history.id,
    project_id: project.id,
    project_name_snapshot: project.name,
    status_snapshot: project.status,
    latest_update_snapshot: project.latest_update,
    next_step_snapshot: project.next_step,
    deadline_snapshot: project.deadline
  })));
  if (snapshotError) {
    await supabase.from("weekly_reports").update({ status: "failed", send_state: "failed", send_error: "Could not save project snapshots." }).eq("id", history.id);
    throw new Error("Could not save report snapshots. No email was sent.");
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const email = buildEmail(report);
    const result = await resend.emails.send({
      from: process.env.REPORT_FROM_EMAIL!,
      to: report.recipients[0].email,
      bcc: report.recipients.slice(1).map(recipient => recipient.email),
      subject: email.subject,
      html: email.html
    });
    if (result.error) {
      await supabase.from("weekly_reports").update({ status: "failed", send_state: "failed", send_error: result.error.message.slice(0, 1000) }).eq("id", history.id);
      return { ok: false as const, duplicate: false, error: result.error.message };
    }

    const { error: completeError } = await supabase.from("weekly_reports").update({
      status: "sent",
      send_state: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: result.data?.id ?? null,
      send_error: null
    }).eq("id", history.id);
    if (completeError) return { ok: false as const, duplicate: false, error: "Email was accepted by Resend, but report history could not be finalized. The send is locked to prevent duplicates." };
    return { ok: true as const, report_id: history.id, provider_message_id: result.data?.id ?? null, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The email provider rejected the report.";
    // A transport exception can happen after the provider accepted the email.
    // Keep the sending lock until an operator reconciles the ambiguous outcome.
    await supabase.from("weekly_reports").update({ status: "failed", send_error: `Delivery outcome uncertain: ${message}`.slice(0, 1000) }).eq("id", history.id);
    return { ok: false as const, duplicate: false, error: `Delivery outcome is uncertain; duplicate sending has been blocked. Reconcile report ${history.id} with Resend before retrying.` };
  }
}
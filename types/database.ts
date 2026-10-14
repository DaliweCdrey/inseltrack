export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_feedback"
  | "completed"
  | "on_hold";

export type Priority = "low" | "normal" | "high" | "urgent";
export type AccountRole = "admin" | "user" | "guest";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AccountRole;
  client_id: string | null;
  approved: boolean;
  is_active: boolean;
  rejected_at: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  industry: string | null;
  reporting_enabled: boolean;
  reporting_day: string;
  reporting_time: string;
};

export type ClientRecipient = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type WeeklyReport = {
  id: string;
  client_id: string | null;
  report_type: "client" | "internal";
  period_start: string;
  period_end: string;
  recipient_count: number;
  project_count: number;
  status: "draft" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
  provider_message_id: string | null;
  send_source: "manual" | "scheduled" | null;
  send_error: string | null;
  send_state: "idle" | "sending" | "sent" | "failed" | "superseded";
};

export type WeeklyReportProjectSnapshot = {
  id: string;
  report_id: string;
  project_id: string | null;
  project_name_snapshot: string;
  status_snapshot: string;
  latest_update_snapshot: string | null;
  next_step_snapshot: string | null;
  deadline_snapshot: string | null;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  deadline: string | null;
  status: ProjectStatus;
  latest_update: string | null;
  next_step: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  client?: Client;
};

export type ProjectInternalDetails = {
  project_id: string;
  assigned_to: string | null;
  requested_by: string | null;
  priority: Priority;
  internal_notes: string | null;
};

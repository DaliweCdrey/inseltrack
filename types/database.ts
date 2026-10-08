export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_feedback"
  | "completed"
  | "on_hold";

export type Priority = "low" | "normal" | "high" | "urgent";

export type Client = {
  id: string;
  name: string;
  industry: string | null;
  reporting_enabled: boolean;
  reporting_day: string;
  reporting_time: string;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  deadline: string | null;
  status: ProjectStatus;
  priority: Priority;
  latest_update: string | null;
  next_step: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  client?: Client;
};

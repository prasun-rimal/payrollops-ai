export type Severity = "critical" | "high" | "medium" | "low";
export type Status = "open" | "approved" | "dismissed";
export type UserRole = "admin" | "reviewer";
export type User = { id: number; name: string; email: string; role: UserRole };
export type AuthResponse = { access_token: string; token_type: "bearer"; user: User };

export type CaseItem = {
  id: number; payroll_run_id: number; worker_id: string; worker_name: string; country: string;
  rule_code: string; title: string; severity: Severity; status: Status; amount: string;
  explanation: string; recommendation: string; policy_citation: string; confidence: string;
  assigned_to: string; created_at: string; updated_at: string;
};

export type Summary = {
  open_cases: number; critical_cases: number; approval_rate: number; estimated_hours_saved: number;
  payroll_total: string; workers_processed: number; cases_by_severity: Record<Severity, number>;
  cases_by_country: Record<string, number>;
};

export type AuditEvent = { id: number; case_id: number | null; event_type: string; actor: string; detail: string; created_at: string };
export type PayrollRun = { id: number; name: string; period: string; country_count: number; worker_count: number; gross_total: string; status: string; created_at: string };
export type Policy = { id: number; document_name: string; section: string; content: string; country: string };
export type SystemStatus = { api: string; ai_provider: string; model: string; database: string; structured_outputs: boolean; human_approval: boolean };

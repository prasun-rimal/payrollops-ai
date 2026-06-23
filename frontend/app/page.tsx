"use client";

import {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  Filter,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Severity = "critical" | "high" | "medium" | "low";
type Status = "open" | "approved" | "dismissed";

type CaseItem = {
  id: number;
  worker_id: string;
  worker_name: string;
  country: string;
  rule_code: string;
  title: string;
  severity: Severity;
  status: Status;
  amount: string;
  explanation: string;
  recommendation: string;
  policy_citation: string;
  confidence: string;
  assigned_to: string;
};

type Summary = {
  open_cases: number;
  critical_cases: number;
  approval_rate: number;
  estimated_hours_saved: number;
  payroll_total: string;
  workers_processed: number;
  cases_by_severity: Record<Severity, number>;
  cases_by_country: Record<string, number>;
};

type AuditEvent = {
  id: number;
  case_id: number | null;
  event_type: string;
  actor: string;
  detail: string;
  created_at: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const severityOrder: Severity[] = ["critical", "high", "medium", "low"];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`severity severity-${severity}`}><span />{severity}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [summaryResponse, casesResponse, auditResponse] = await Promise.all([
        fetch(`${API}/api/dashboard`, { cache: "no-store" }),
        fetch(`${API}/api/cases`, { cache: "no-store" }),
        fetch(`${API}/api/audit`, { cache: "no-store" }),
      ]);
      if (!summaryResponse.ok || !casesResponse.ok || !auditResponse.ok) throw new Error("The operations API returned an error.");
      setSummary(await summaryResponse.json());
      setCases(await casesResponse.json());
      setAudit(await auditResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to reach the operations API.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCases = useMemo(() => cases.filter((item) => {
    const matchesSeverity = severity === "all" || item.severity === severity;
    const haystack = `${item.worker_name} ${item.worker_id} ${item.title} ${item.country}`.toLowerCase();
    return matchesSeverity && haystack.includes(query.toLowerCase());
  }), [cases, query, severity]);

  const chartData = severityOrder.map((key) => ({ severity: key, cases: summary?.cases_by_severity[key] || 0 }));

  async function resolveCase(item: CaseItem, status: Status) {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/cases/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor: "Demo operator" }),
      });
      if (!response.ok) throw new Error("Case update failed");
      setSelected(null);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Case update failed");
      setBusy(false);
    }
  }

  async function uploadPayroll(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("name", file.name.replace(/\.csv$/i, ""));
    form.append("period", "Imported demo period");
    try {
      const response = await fetch(`${API}/api/runs/upload`, { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Payroll import failed");
      }
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Payroll import failed");
      setBusy(false);
    } finally {
      event.target.value = "";
    }
  }

  async function runAiReview() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/review`, { method: "POST" });
      if (!response.ok) throw new Error("AI review failed");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "AI review failed");
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>PayrollOps</strong><span>AI control center</span></div></div>
        <nav aria-label="Primary navigation">
          <a className="nav-item active" href="#overview"><LayoutDashboard size={18} />Overview</a>
          <a className="nav-item" href="#exceptions"><CircleAlert size={18} />Exception queue<span className="nav-count">{summary?.open_cases ?? 0}</span></a>
          <a className="nav-item" href="#runs"><ListChecks size={18} />Payroll runs</a>
          <a className="nav-item" href="#policies"><FileCheck2 size={18} />Policy library</a>
          <a className="nav-item" href="#audit"><Activity size={18} />Audit trail</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="ai-status"><span className="pulse" /><div><strong>AI workflow online</strong><span>Structured output validation</span></div></div>
          <button className="nav-item button-reset"><Settings size={18} />Settings</button>
          <div className="operator"><div className="avatar">PR</div><div><strong>Prasun Rimal</strong><span>Operations admin</span></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">Global payroll operations</p><h1>Exception control center</h1></div>
          <div className="header-actions"><button className="icon-button" title="Notifications"><Bell size={18} /></button><input ref={fileInput} onChange={uploadPayroll} className="visually-hidden" type="file" accept=".csv,text/csv" /><button className="secondary" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={17} />Import payroll</button><button className="primary" onClick={() => void runAiReview()} disabled={busy}><Bot size={17} />Run AI review</button></div>
        </header>

        <section className="content" id="overview">
          {error && <div className="error-banner"><CircleAlert size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}

          <div className="run-strip">
            <div className="run-title"><span className="run-icon"><Gauge size={18} /></span><div><strong>June 2026 Global Payroll</strong><span>Jun 1-15 · 4 countries · {summary?.workers_processed ?? 0} workers</span></div></div>
            <div className="pipeline"><span className="done"><Check size={14} />Ingested</span><i /><span className="done"><Check size={14} />Validated</span><i /><span className="current"><Sparkles size={14} />Review required</span></div>
            <button className="icon-button" onClick={() => void load()} title="Refresh data"><RefreshCw className={busy ? "spinning" : ""} size={18} /></button>
          </div>

          <div className="metrics">
            <div className="metric"><div><span>Payroll processed</span><strong>{currency.format(Number(summary?.payroll_total || 0))}</strong><small>{summary?.workers_processed ?? 0} worker records</small></div><span className="metric-icon green"><BadgeCheck size={20} /></span></div>
            <div className="metric"><div><span>Open exceptions</span><strong>{summary?.open_cases ?? 0}</strong><small><b>{summary?.critical_cases ?? 0} critical</b> require attention</small></div><span className="metric-icon coral"><CircleAlert size={20} /></span></div>
            <div className="metric"><div><span>Estimated time saved</span><strong>{summary?.estimated_hours_saved ?? 0}h</strong><small>Across this payroll run</small></div><span className="metric-icon blue"><Clock3 size={20} /></span></div>
            <div className="metric"><div><span>AI confidence</span><strong>94.2%</strong><small>Schema-valid classifications</small></div><span className="metric-icon violet"><Sparkles size={20} /></span></div>
          </div>

          <div className="work-grid">
            <section className="panel queue" id="exceptions">
              <div className="panel-heading"><div><h2>Exception queue</h2><p>AI-classified findings awaiting an operator decision</p></div><button className="icon-button" title="More actions"><MoreHorizontal size={19} /></button></div>
              <div className="table-tools">
                <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workers or exceptions" /></label>
                <label className="select-control"><Filter size={15} /><select value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "all")}><option value="all">All severities</option>{severityOrder.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Exception</th><th>Worker</th><th>Severity</th><th>Confidence</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {visibleCases.map((item) => (
                      <tr key={item.id} onClick={() => setSelected(item)}>
                        <td><strong>{item.title}</strong><span>{item.rule_code.replaceAll("_", " ")}</span></td>
                        <td><strong>{item.worker_name}</strong><span>{item.worker_id} · {item.country}</span></td>
                        <td><SeverityBadge severity={item.severity} /></td>
                        <td><div className="confidence"><span style={{ width: `${Number(item.confidence) * 100}%` }} /><b>{Math.round(Number(item.confidence) * 100)}%</b></div></td>
                        <td><StatusBadge status={item.status} /></td>
                        <td><button className="icon-button compact" title="Open case"><MoreHorizontal size={17} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">Showing {visibleCases.length} of {cases.length} findings<span>Human approval required for every payment-impacting action</span></div>
            </section>

            <aside className="insights">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h2>Risk distribution</h2><p>Findings by severity</p></div></div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={chartData} margin={{ top: 8, right: 2, left: -30, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e7e9ee" />
                    <XAxis dataKey="severity" axisLine={false} tickLine={false} tick={{ fill: "#727784", fontSize: 11 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8a8f9b", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "#f4f5f7" }} contentStyle={{ border: "1px solid #dddfe5", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="cases" fill="#173f38" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
              <section className="panel audit-panel" id="audit">
                <div className="panel-heading"><div><h2>Workflow activity</h2><p>Latest auditable events</p></div></div>
                <div className="timeline">
                  {audit.slice(0, 5).map((event) => <div className="timeline-item" key={event.id}><span><ShieldCheck size={14} /></span><div><strong>{event.event_type.replaceAll("_", " ")}</strong><p>{event.detail}</p><small>{new Date(event.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {event.actor}</small></div></div>)}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>

      {selected && <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="case-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><span className="case-id">Case #{selected.id.toString().padStart(4, "0")}</span><h2>{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} title="Close case"><X size={19} /></button></div>
        <div className="drawer-meta"><SeverityBadge severity={selected.severity} /><StatusBadge status={selected.status} /><span>{Math.round(Number(selected.confidence) * 100)}% confidence</span></div>
        <section className="case-section"><h3>Worker record</h3><dl><div><dt>Worker</dt><dd>{selected.worker_name}</dd></div><div><dt>Identifier</dt><dd>{selected.worker_id}</dd></div><div><dt>Country</dt><dd>{selected.country}</dd></div><div><dt>Gross amount</dt><dd>{currency.format(Number(selected.amount))}</dd></div></dl></section>
        <section className="case-section ai-analysis"><div className="section-title"><Sparkles size={16} /><h3>AI analysis</h3></div><p>{selected.explanation}</p><h4>Recommended action</h4><p>{selected.recommendation}</p></section>
        <section className="case-section citation"><div className="section-title"><FileCheck2 size={16} /><h3>Grounding evidence</h3></div><p>{selected.policy_citation}</p><small>Retrieved from the policy library for this worker country and exception type.</small></section>
        <div className="drawer-actions"><button className="secondary danger" disabled={busy} onClick={() => void resolveCase(selected, "dismissed")}><X size={17} />Dismiss</button><button className="primary" disabled={busy} onClick={() => void resolveCase(selected, "approved")}><Check size={17} />Approve resolution</button></div>
      </aside></div>}
    </div>
  );
}

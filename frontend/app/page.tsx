"use client";

import { Activity, ArrowRight, BadgeCheck, CircleAlert, Clock3, FileCheck2, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getJson } from "@/lib/api";
import { AuditEvent, CaseItem, Summary } from "@/lib/types";
import { SeverityBadge } from "@/components/Badges";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getJson<Summary>("/api/dashboard"), getJson<CaseItem[]>("/api/cases"), getJson<AuditEvent[]>("/api/audit")])
      .then(([summaryData, caseData, auditData]) => { setSummary(summaryData); setCases(caseData); setAudit(auditData); })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const chartData = ["critical", "high", "medium", "low"].map((severity) => ({ severity, cases: summary?.cases_by_severity[severity as keyof Summary["cases_by_severity"]] || 0 }));
  const priorityCases = cases.filter((item) => item.status === "open").slice(0, 4);

  return <section className="content page-content">
    {error && <div className="error-banner"><CircleAlert size={18} />{error}</div>}
    <div className="metrics">
      <div className="metric"><div><span>Payroll processed</span><strong>{currency.format(Number(summary?.payroll_total || 0))}</strong><small>{summary?.workers_processed ?? 0} worker records</small></div><span className="metric-icon green"><BadgeCheck size={20} /></span></div>
      <div className="metric"><div><span>Open exceptions</span><strong>{summary?.open_cases ?? 0}</strong><small><b>{summary?.critical_cases ?? 0} critical</b> require attention</small></div><span className="metric-icon coral"><CircleAlert size={20} /></span></div>
      <div className="metric"><div><span>Estimated time saved</span><strong>{summary?.estimated_hours_saved ?? 0}h</strong><small>Across all reviewed findings</small></div><span className="metric-icon blue"><Clock3 size={20} /></span></div>
      <div className="metric"><div><span>Workers processed</span><strong>{summary?.workers_processed ?? 0}</strong><small>Across 4 configured countries</small></div><span className="metric-icon violet"><Users size={20} /></span></div>
    </div>

    <div className="overview-grid">
      <section className="panel priority-panel">
        <div className="panel-heading"><div><h2>Priority exceptions</h2><p>Highest-risk findings awaiting review</p></div><Link className="text-link" href="/exceptions">Open queue <ArrowRight size={14} /></Link></div>
        <div className="priority-list">
          {priorityCases.map((item) => <Link href={`/exceptions?case=${item.id}`} className="priority-row" key={item.id}><span className="priority-icon"><CircleAlert size={16} /></span><div><strong>{item.title}</strong><span>{item.worker_name} · {item.country}</span></div><SeverityBadge severity={item.severity} /><ArrowRight size={15} /></Link>)}
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="panel-heading"><div><h2>Risk distribution</h2><p>Current findings by severity</p></div></div>
        <ResponsiveContainer width="100%" height={220}><BarChart data={chartData} margin={{ top: 12, right: 15, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e7e9ee" /><XAxis dataKey="severity" axisLine={false} tickLine={false} tick={{ fill: "#727784", fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8a8f9b", fontSize: 11 }} /><Tooltip cursor={{ fill: "#f4f5f7" }} contentStyle={{ border: "1px solid #dddfe5", borderRadius: 6, fontSize: 12 }} /><Bar dataKey="cases" fill="#173f38" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
      </section>

      <section className="panel workflow-panel">
        <div className="panel-heading"><div><h2>Workflow health</h2><p>Production safety controls</p></div><Sparkles size={18} /></div>
        <div className="control-list"><div><BadgeCheck size={17} /><span><strong>Structured outputs</strong><small>Pydantic schema enforcement</small></span><b>Healthy</b></div><div><FileCheck2 size={17} /><span><strong>Grounded retrieval</strong><small>Country-aware policy evidence</small></span><b>Healthy</b></div><div><Users size={17} /><span><strong>Human approval</strong><small>Required before resolution</small></span><b>Enforced</b></div></div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest system and operator events</p></div><Link className="text-link" href="/audit">Full audit <ArrowRight size={14} /></Link></div>
        <div className="compact-timeline">{audit.slice(0, 5).map((event) => <div className="timeline-item" key={event.id}><span><Activity size={14} /></span><p><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.detail}</span><small>{new Date(event.created_at).toLocaleString()} · {event.actor}</small></p></div>)}</div>
      </section>
    </div>
  </section>;
}

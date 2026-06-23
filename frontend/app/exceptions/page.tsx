"use client";

import { CircleAlert, Filter, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { SeverityBadge, StatusBadge } from "@/components/Badges";
import CaseDrawer from "@/components/CaseDrawer";
import { getJson, sendJson } from "@/lib/api";
import { CaseItem, Severity, Status } from "@/lib/types";

const severities: Severity[] = ["critical", "high", "medium", "low"];

function ExceptionQueue() {
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getJson<CaseItem[]>("/api/cases");
      setCases(data);
      const requested = Number(searchParams.get("case"));
      if (requested) setSelected(data.find((item) => item.id === requested) || null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load cases"); }
  }, [searchParams]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => cases.filter((item) => {
    const text = `${item.worker_name} ${item.worker_id} ${item.title} ${item.country}`.toLowerCase();
    return (severity === "all" || item.severity === severity) && (status === "all" || item.status === status) && text.includes(query.toLowerCase());
  }), [cases, query, severity, status]);

  async function resolve(nextStatus: Status) {
    if (!selected) return;
    setBusy(true);
    try { await sendJson(`/api/cases/${selected.id}`, "PATCH", { status: nextStatus }); setSelected(null); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Update failed"); }
    finally { setBusy(false); }
  }

  return <section className="content page-content">
    {error && <div className="error-banner"><CircleAlert size={18} />{error}</div>}
    <div className="page-actions"><div><strong>{cases.filter((item) => item.status === "open").length} open findings</strong><span>Every resolution is recorded in the audit trail.</span></div><button className="secondary" onClick={() => void load()}><RefreshCw size={16} />Refresh</button></div>
    <section className="panel queue full-queue">
      <div className="table-tools"><label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workers or exceptions" /></label><label className="select-control"><Filter size={15} /><select value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "all")}><option value="all">All severities</option>{severities.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value as Status | "all")}><option value="all">All statuses</option><option value="open">Open</option><option value="approved">Approved</option><option value="dismissed">Dismissed</option></select></label></div>
      <div className="table-wrap"><table><thead><tr><th>Exception</th><th>Worker</th><th>Assigned team</th><th>Severity</th><th>Confidence</th><th>Status</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><strong>{item.title}</strong><span>{item.rule_code.replaceAll("_", " ")}</span></td><td><strong>{item.worker_name}</strong><span>{item.worker_id} · {item.country}</span></td><td>{item.assigned_to}</td><td><SeverityBadge severity={item.severity} /></td><td>{Math.round(Number(item.confidence) * 100)}%</td><td><StatusBadge status={item.status} /></td><td><button className="icon-button compact" title="Open case"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
      <div className="table-footer">Showing {visible.length} of {cases.length} findings<span>Click any row to inspect evidence and resolve it</span></div>
    </section>
    {selected && <CaseDrawer item={selected} busy={busy} onClose={() => setSelected(null)} onResolve={(next) => void resolve(next)} />}
  </section>;
}

export default function ExceptionsPage() { return <Suspense fallback={<div className="content">Loading exceptions...</div>}><ExceptionQueue /></Suspense>; }

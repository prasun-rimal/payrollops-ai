"use client";

import { Download, FileSpreadsheet, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { API, authHeaders, getJson } from "@/lib/api";
import { CaseItem, PayrollRun } from "@/lib/types";
import { SeverityBadge, StatusBadge } from "@/components/Badges";
import { useAuth } from "@/components/AuthProvider";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function RunsPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selected, setSelected] = useState<PayrollRun | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function loadRuns() { const data = await getJson<PayrollRun[]>("/api/runs"); setRuns(data); if (!selected && data[0]) await inspect(data[0]); }
  async function inspect(run: PayrollRun) { setSelected(run); setCases(await getJson<CaseItem[]>(`/api/runs/${run.id}/cases`)); }
  useEffect(() => { void loadRuns(); }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage("");
    const form = new FormData(); form.append("file", file); form.append("name", file.name.replace(/\.csv$/i, "")); form.append("period", "Imported demo period");
    try { const response = await fetch(`${API}/api/runs/upload`, { method: "POST", headers: authHeaders(), body: form }); const payload = await response.json(); if (!response.ok) throw new Error(payload.detail); setMessage(`Imported ${payload.worker_count} rows successfully.`); await loadRuns(); await inspect(payload); }
    catch (requestError) { setMessage(requestError instanceof Error ? requestError.message : "Import failed"); }
    finally { setBusy(false); event.target.value = ""; }
  }

  return <section className="content page-content">
    <div className="page-actions"><div><strong>Payroll ingestion</strong><span>{user?.role === "admin" ? "Apply deterministic controls, retrieve policy evidence, and generate structured Gemini analysis." : "Run imports are restricted to operations administrators."}</span></div><input ref={input} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={upload} /><div className="page-action-buttons"><a className="secondary" href="/sample-payroll.csv" download><Download size={17} />Sample CSV</a>{user?.role === "admin" && <button className="primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? <LoaderCircle className="spinning" size={17} /> : <Upload size={17} />}{busy ? "Analyzing payroll..." : "Import payroll CSV"}</button>}</div></div>
    {busy && <div className="processing-banner"><LoaderCircle className="spinning" size={18} /><div><strong>Running payroll controls</strong><span>Retrieving policy evidence and generating schema-validated Gemini analyses.</span></div></div>}
    {message && <div className="info-banner">{message}</div>}
    <div className="runs-layout">
      <section className="panel runs-list"><div className="panel-heading"><div><h2>Run history</h2><p>{runs.length} processed batches</p></div><button className="icon-button" title="Refresh runs" onClick={() => void loadRuns()}><RefreshCw size={17} /></button></div>{runs.map((run) => <button className={`run-row ${selected?.id === run.id ? "selected" : ""}`} onClick={() => void inspect(run)} key={run.id}><span className="run-file"><FileSpreadsheet size={18} /></span><span><strong>{run.name}</strong><small>{run.period} · {run.worker_count} workers</small></span><b>{currency.format(Number(run.gross_total))}</b></button>)}</section>
      <section className="panel run-detail"><div className="panel-heading"><div><h2>{selected?.name || "Select a run"}</h2><p>{selected ? `${selected.period} · ${selected.country_count} countries` : "Inspect validation results"}</p></div></div>{selected && <><div className="run-summary"><div><span>Gross payroll</span><strong>{currency.format(Number(selected.gross_total))}</strong></div><div><span>Worker records</span><strong>{selected.worker_count}</strong></div><div><span>Exceptions</span><strong>{cases.length}</strong></div><div><span>Run status</span><strong className="capitalize">{selected.status.replaceAll("_", " ")}</strong></div></div><div className="mini-table"><div className="mini-table-head"><span>Finding</span><span>Worker</span><span>Risk</span><span>Status</span></div>{cases.map((item) => <div className="mini-table-row" key={item.id}><span>{item.title}</span><span>{item.worker_name}</span><SeverityBadge severity={item.severity} /><StatusBadge status={item.status} /></div>)}</div></>}</section>
    </div>
  </section>;
}

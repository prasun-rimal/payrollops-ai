"use client";

import { FileCheck2, Plus, Search, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getJson, sendJson } from "@/lib/api";
import { Policy } from "@/lib/types";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() { setPolicies(await getJson<Policy[]>("/api/policies")); }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => policies.filter((policy) => `${policy.document_name} ${policy.section} ${policy.country} ${policy.content}`.toLowerCase().includes(query.toLowerCase())), [policies, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    try { await sendJson("/api/policies", "POST", Object.fromEntries(form)); setOpen(false); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to add policy"); }
  }

  return <section className="content page-content">
    <div className="page-actions"><div><strong>{policies.length} policy sections indexed</strong><span>Each section receives an embedding for country-aware retrieval.</span></div><button className="primary" onClick={() => setOpen(true)}><Plus size={17} />Add policy section</button></div>
    <section className="panel"><div className="table-tools"><label className="search wide-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search policies, countries, or controls" /></label></div><div className="policy-grid">{visible.map((policy) => <article className="policy-item" key={policy.id}><div className="policy-heading"><span><FileCheck2 size={18} /></span><div><strong>{policy.document_name}</strong><small>{policy.section}</small></div><b>{policy.country}</b></div><p>{policy.content}</p><div className="policy-foot"><Sparkles size={13} />Vector indexed for grounded retrieval</div></article>)}</div></section>
    {open && <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-heading"><div><h2>Add policy section</h2><p>New text becomes available to the retrieval workflow.</p></div><button type="button" className="icon-button" title="Close policy form" onClick={() => setOpen(false)}><X size={18} /></button></div>{error && <div className="error-banner">{error}</div>}<div className="form-grid"><label className="wide-field">Document name<input name="document_name" required minLength={3} placeholder="Global Payroll Controls" /></label><label>Section<input name="section" required minLength={3} placeholder="Payment currency" /></label><label>Country<input name="country" required defaultValue="Global" /></label><label className="wide-field">Policy text<textarea name="content" required minLength={20} rows={6} placeholder="Describe the control and required operator action." /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" type="submit">Index policy</button></div></form></div>}
  </section>;
}

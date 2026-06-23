"use client";

import { Check, FileCheck2, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AIReview, CaseItem, Status } from "@/lib/types";
import { getJson } from "@/lib/api";
import { SeverityBadge, StatusBadge } from "./Badges";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CaseDrawer({ item, busy, onClose, onResolve }: { item: CaseItem; busy: boolean; onClose: () => void; onResolve: (status: Status) => void }) {
  const [reviews, setReviews] = useState<AIReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  useEffect(() => {
    setLoadingReviews(true); setPendingStatus(null);
    getJson<AIReview[]>(`/api/cases/${item.id}/reviews`).then(setReviews).finally(() => setLoadingReviews(false));
  }, [item.id]);
  const latestReview = reviews[0];

  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="case-drawer" onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-header"><div><span className="case-id">Case #{item.id.toString().padStart(4, "0")}</span><h2>{item.title}</h2></div><button className="icon-button" onClick={onClose} title="Close case"><X size={19} /></button></div>
    <div className="drawer-meta"><SeverityBadge severity={item.severity} /><StatusBadge status={item.status} /><span>{Math.round(Number(item.confidence) * 100)}% confidence</span></div>
    <section className="case-section"><h3>Worker record</h3><dl><div><dt>Worker</dt><dd>{item.worker_name}</dd></div><div><dt>Identifier</dt><dd>{item.worker_id}</dd></div><div><dt>Country</dt><dd>{item.country}</dd></div><div><dt>Gross amount</dt><dd>{currency.format(Number(item.amount))}</dd></div></dl></section>
    <section className="case-section ai-analysis"><div className="section-title"><Sparkles size={16} /><h3>AI analysis</h3></div>{loadingReviews ? <div className="review-loading"><LoaderCircle className="spinning" size={15} />Loading provenance</div> : latestReview ? <div className="ai-provenance"><span className={`provider-pill ${latestReview.fallback_reason ? "fallback" : ""}`}>{latestReview.provider}</span><div><strong>{latestReview.model}</strong><small>{new Date(latestReview.created_at).toLocaleString()} · Review #{reviews.length}</small></div></div> : <div className="legacy-analysis">Seeded analysis · Run an AI review to record provider provenance.</div>}<p>{item.explanation}</p><h4>Recommended action</h4><p>{item.recommendation}</p>{latestReview?.fallback_reason && <div className="fallback-note">Gemini was unavailable, so this review used the deterministic fallback.</div>}</section>
    <section className="case-section citation"><div className="section-title"><FileCheck2 size={16} /><h3>Grounding evidence</h3></div><p>{item.policy_citation}</p><small>Retrieved from the policy library for this worker country and exception type.</small></section>
    <div className="drawer-actions">{pendingStatus ? <div className="resolution-confirm"><p><strong>{pendingStatus === "approved" ? "Approve this resolution?" : "Dismiss this finding?"}</strong><span>This operator decision will be written to the audit trail.</span></p><button className="secondary" disabled={busy} onClick={() => setPendingStatus(null)}>Cancel</button><button className={pendingStatus === "approved" ? "primary" : "secondary danger"} disabled={busy} onClick={() => onResolve(pendingStatus)}>{busy ? <LoaderCircle className="spinning" size={16} /> : pendingStatus === "approved" ? <Check size={16} /> : <X size={16} />}Confirm</button></div> : <><button className="secondary danger" disabled={busy} onClick={() => setPendingStatus("dismissed")}><X size={17} />Dismiss</button><button className="primary" disabled={busy} onClick={() => setPendingStatus("approved")}><Check size={17} />Approve resolution</button></>}</div>
  </aside></div>;
}

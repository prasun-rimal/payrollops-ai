"use client";

import { Activity, Bot, Search, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getJson } from "@/lib/api";
import { AuditEvent } from "@/lib/types";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => { getJson<AuditEvent[]>("/api/audit").then(setEvents); }, []);
  const visible = useMemo(() => events.filter((event) => `${event.event_type} ${event.actor} ${event.detail}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  return <section className="content page-content">
    <div className="audit-summary"><div><ShieldCheck size={18} /><span><strong>{events.length}</strong> recent events</span></div><div><UserRound size={18} /><span><strong>{events.filter((event) => event.actor !== "system").length}</strong> operator actions</span></div><div><Bot size={18} /><span><strong>{events.filter((event) => event.actor === "system" || event.actor === "AI workflow").length}</strong> system actions</span></div></div>
    <section className="panel"><div className="table-tools"><label className="search wide-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, actors, or case activity" /></label></div><div className="audit-table"><div className="audit-head"><span>Event</span><span>Details</span><span>Actor</span><span>Timestamp</span></div>{visible.map((event) => <div className="audit-row" key={event.id}><span><i><Activity size={14} /></i><strong>{event.event_type.replaceAll("_", " ")}</strong>{event.case_id && <small>Case #{event.case_id.toString().padStart(4, "0")}</small>}</span><p>{event.detail}</p><b>{event.actor}</b><time>{new Date(event.created_at).toLocaleString()}</time></div>)}</div></section>
  </section>;
}


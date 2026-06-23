"use client";

import { BadgeCheck, Bot, Database, KeyRound, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { SystemStatus } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

export default function SettingsPage() {
  const { user } = useAuth();
  const [system, setSystem] = useState<SystemStatus | null>(null);
  useEffect(() => { getJson<SystemStatus>("/api/system").then(setSystem); }, []);
  const rows = [
    { icon: Users, label: "Signed-in user", value: user ? `${user.name} · ${user.role}` : "Loading", help: user?.email || "Authenticated session identity." },
    { icon: Bot, label: "AI provider", value: system?.ai_provider || "Loading", help: "Switch with AI_PROVIDER in the backend environment." },
    { icon: BadgeCheck, label: "Model", value: system?.model || "Loading", help: "Structured exception classification model." },
    { icon: Database, label: "Database", value: system?.database || "Loading", help: "PostgreSQL uses pgvector; SQLite is the local fallback." },
    { icon: KeyRound, label: "Secrets", value: "Environment only", help: "API keys are never stored in the browser or repository." },
  ];
  return <section className="content page-content settings-layout">
    <section className="panel settings-panel"><div className="panel-heading"><div><h2>Runtime configuration</h2><p>Read-only values reported by the backend</p></div></div><div className="settings-list">{rows.map((row) => { const Icon = row.icon; return <div key={row.label}><span><Icon size={18} /></span><div><strong>{row.label}</strong><small>{row.help}</small></div><b className="capitalize">{row.value}</b></div>; })}</div></section>
    <section className="panel safety-panel"><div className="panel-heading"><div><h2>Safety controls</h2><p>Controls intentionally enforced by the product</p></div></div><div className="safety-list"><div><ShieldCheck size={19} /><p><strong>Schema validation</strong><span>Every AI classification must match the ExceptionAnalysis Pydantic model.</span></p><b>On</b></div><div><Users size={19} /><p><strong>Human approval</strong><span>No payment-impacting recommendation resolves itself automatically.</span></p><b>On</b></div><div><Database size={19} /><p><strong>Audit persistence</strong><span>Imports, reviews, and operator decisions create timestamped events.</span></p><b>On</b></div></div></section>
    <section className="settings-note"><KeyRound size={20} /><div><strong>{system?.ai_provider === "gemini" ? "Real Gemini analysis is enabled" : "AI provider configuration"}</strong><p>{system?.ai_provider === "gemini" ? "Gemini generates schema-validated exception analysis and semantic policy embeddings. Only synthetic payroll data is sent to the free-tier API." : "Set GEMINI_API_KEY and AI_PROVIDER=gemini in the backend environment to enable free structured analysis. Mock mode remains available offline."}</p></div></section>
  </section>;
}

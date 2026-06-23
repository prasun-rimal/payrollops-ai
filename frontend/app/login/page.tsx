"use client";

import { ArrowRight, BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const demos = {
  admin: { email: "admin@payrollops.demo", password: "DemoAdmin!2026", label: "Admin", detail: "Manage runs, policies, and reviews" },
  reviewer: { email: "reviewer@payrollops.demo", password: "DemoReviewer!2026", label: "Reviewer", detail: "Investigate and resolve exceptions" },
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState(demos.admin.email);
  const [password, setPassword] = useState(demos.admin.password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!loading && user) router.replace("/"); }, [loading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await login(email, password); router.replace("/"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }

  function selectDemo(type: keyof typeof demos) { setEmail(demos[type].email); setPassword(demos[type].password); setError(""); }

  return <main className="login-page">
    <section className="login-story"><div className="login-brand"><span><Sparkles size={20} /></span><strong>PayrollOps AI</strong></div><div><p className="eyebrow">Secure payroll operations</p><h1>Resolve payroll risk with evidence, control, and accountability.</h1><p>Deterministic validation finds the problem. Grounded AI explains it. Authorized operators make the final decision.</p></div><div className="login-controls"><span><BadgeCheck size={17} />Structured outputs</span><span><ShieldCheck size={17} />Role-based access</span><span><LockKeyhole size={17} />Audited decisions</span></div></section>
    <section className="login-panel"><div className="login-form-wrap"><p className="eyebrow">Demo workspace</p><h2>Sign in to PayrollOps</h2><p className="login-intro">Choose a role or enter the seeded demo credentials.</p><div className="demo-role-grid">{Object.entries(demos).map(([key, demo]) => <button type="button" className={email === demo.email ? "selected" : ""} onClick={() => selectDemo(key as keyof typeof demos)} key={key}><span>{demo.label}</span><small>{demo.detail}</small></button>)}</div><form className="login-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={8} /></label>{error && <div className="login-error">{error}</div>}<button className="primary login-submit" disabled={busy}>{busy ? "Signing in..." : "Enter operations center"}<ArrowRight size={17} /></button></form><p className="demo-note">Synthetic payroll data only. No real employee information is stored.</p></div></section>
  </main>;
}

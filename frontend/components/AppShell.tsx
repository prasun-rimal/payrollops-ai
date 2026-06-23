"use client";

import { Activity, Bell, CircleAlert, FileCheck2, LayoutDashboard, ListChecks, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/exceptions", label: "Exception queue", icon: CircleAlert },
  { href: "/runs", label: "Payroll runs", icon: ListChecks },
  { href: "/policies", label: "Policy library", icon: FileCheck2 },
  { href: "/audit", label: "Audit trail", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const headings: Record<string, [string, string]> = {
  "/": ["Operations overview", "Global payroll controls and workflow health"],
  "/exceptions": ["Exception queue", "Investigate and resolve payment-impacting findings"],
  "/runs": ["Payroll runs", "Import, validate, and inspect payroll batches"],
  "/policies": ["Policy library", "Manage the evidence used for grounded AI analysis"],
  "/audit": ["Audit trail", "Trace every system and operator decision"],
  "/settings": ["System settings", "Review runtime configuration and safety controls"],
};

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isLogin = pathname === "/login";
  useEffect(() => { if (!loading && !user && !isLogin) router.replace("/login"); }, [isLogin, loading, router, user]);
  if (isLogin) return children;
  if (loading || !user) return <div className="auth-loading"><span className="pulse" />Verifying secure session</div>;
  const [title, subtitle] = headings[pathname] || headings["/"];
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>PayrollOps</strong><span>AI control center</span></div></Link>
      <nav aria-label="Primary navigation">
        {navigation.map((item) => { const Icon = item.icon; return <Link className={`nav-item ${pathname === item.href ? "active" : ""}`} href={item.href} key={item.href}><Icon size={18} />{item.label}</Link>; })}
      </nav>
      <div className="sidebar-bottom">
        <div className="ai-status"><span className="pulse" /><div><strong>AI workflow online</strong><span>Structured output validation</span></div></div>
        <div className="operator"><div className="avatar">{initials}</div><div><strong>{user.name}</strong><span>{user.role === "admin" ? "Operations admin" : "Payroll reviewer"}</span></div><button className="operator-logout" title="Sign out" onClick={logout}><LogOut size={16} /></button></div>
      </div>
    </aside>
    <main>
      <header className="topbar"><div><p className="eyebrow">PayrollOps AI</p><h1>{title}</h1><p className="topbar-subtitle">{subtitle}</p></div><div className="header-actions"><span className="environment"><span />Demo environment</span><button className="icon-button" title="Notifications"><Bell size={18} /></button></div></header>
      {children}
    </main>
  </div>;
}

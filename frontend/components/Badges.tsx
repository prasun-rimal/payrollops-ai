import { Severity, Status } from "@/lib/types";

export function SeverityBadge({ severity }: { severity: Severity }) { return <span className={`severity severity-${severity}`}><span />{severity}</span>; }
export function StatusBadge({ status }: { status: Status }) { return <span className={`status status-${status}`}>{status}</span>; }


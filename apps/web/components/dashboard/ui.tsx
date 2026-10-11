import Link from "next/link";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function DashboardShell({
  audience,
  children,
}: {
  audience: "user" | "creator";
  children: ReactNode;
}) {
  return (
    <div className="dashboard-shell">
      <Sidebar audience={audience} />
      <div className="dashboard-content">
        <div className="workspace-topline">
          <span>
            {audience === "creator" ? "Creator studio" : "User workspace"}
          </span>
          <span className="status-badge">Live data not connected</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="dashboard-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  detail,
  value = "—",
  icon = "↗",
}: {
  label: string;
  detail: string;
  value?: string;
  icon?: string;
}) {
  return (
    <article className="metric-card">
      <div>
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  icon = "⌁",
  href,
  action,
}: {
  title: string;
  description: string;
  icon?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="dashboard-empty">
      <span className="empty-symbol" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && action && (
        <Link className="text-link" href={href}>
          {action} ↗
        </Link>
      )}
    </div>
  );
}

export function RecordTable({
  columns,
  emptyTitle,
  emptyDescription,
}: {
  columns: string[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="table-scroll">
      <table className="record-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length}>
              <EmptyState title={emptyTitle} description={emptyDescription} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ConnectionNote({ children }: { children: ReactNode }) {
  return (
    <div className="connection-note">
      <span aria-hidden="true">◎</span>
      <p>{children}</p>
      <Link href="/setup">Connection status ↗</Link>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
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
      <div className="dashboard-content">{children}</div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="dashboard-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
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
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="dashboard-empty">
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

export function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <Link className="action-card" href={href}>
      <span className="action-icon">
        <Icon name={icon} />
      </span>
      <span className="action-text">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="action-arrow">
        <Icon name="arrow" size={16} />
      </span>
    </Link>
  );
}

export function ConnectionNote({ children }: { children: ReactNode }) {
  return (
    <div className="connection-note">
      <p>{children}</p>
    </div>
  );
}

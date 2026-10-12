import type { ReactNode } from "react";
import { Icon, type IconName } from "./dashboard/icons";

export type Role = "user" | "creator";

export const roles: Record<
  Role,
  {
    label: string;
    title: string;
    summary: string;
    icon: IconName;
    points: string[];
    method: string;
    href: string;
    cta: string;
    open: string;
  }
> = {
  user: {
    label: "User login",
    title: "Follow calls and trade",
    summary: "For anyone reading trade calls on X.",
    icon: "trade",
    points: [
      "Check any creator’s identity, stake and call history",
      "Review Kuru spot and Perpl perp trades before you sign",
      "Track your confirmed fills and wallet activity",
    ],
    method: "Sign in with X, email or a wallet.",
    href: "/dashboard",
    cta: "Continue as user",
    open: "Open dashboard",
  },
  creator: {
    label: "Creator login",
    title: "Build a public record",
    summary: "For accounts that post trade calls.",
    icon: "calls",
    points: [
      "Bind your X account to a wallet with a signed message",
      "Lock a refundable stake with a 7-day withdrawal cooldown",
      "Register calls that are priced and scored at expiry",
    ],
    method: "Requires signing in with your X account.",
    href: "/creator",
    cta: "Continue as creator",
    open: "Open creator studio",
  },
};

export function RoleCards({ action }: { action: (role: Role) => ReactNode }) {
  return (
    <div className="start-options">
      {(["user", "creator"] as const).map((role) => {
        const item = roles[role];
        return (
          <article className="role-card" key={role}>
            <div className="role-card-head">
              <span className="action-icon">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="role-label">{item.label}</span>
            </div>
            <div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
            </div>
            <ul className="role-points">
              {item.points.map((point) => (
                <li key={point}>
                  <Icon name="check" size={18} />
                  {point}
                </li>
              ))}
            </ul>
            <div className="role-footer">
              {action(role)}
              <p className="role-method">{item.method}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

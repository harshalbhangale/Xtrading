import type { ReactNode } from "react";
import { DashboardShell } from "../../components/dashboard/ui";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <DashboardShell audience="creator">{children}</DashboardShell>;
}

import type { ReactNode } from "react";
import { DashboardShell } from "../../components/dashboard/ui";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <DashboardShell audience="user">{children}</DashboardShell>;
}

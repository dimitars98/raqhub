import Sidebar from "./Sidebar";
import DashboardTopbar from "./DashboardTopbar";
import { SidebarProvider } from "./SidebarContext";
import { SIDEBAR_COOKIE } from "../../../constants";
import { cookies } from "next/headers";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "admin" | "member";
  userName: string;
  clubName?: string;
}

export default async function DashboardShell({
  children,
  role,
  userName,
  clubName,
}: DashboardShellProps) {
  const cookieStore = await cookies();
  const defaultCollapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <div className="flex h-screen bg-[#f8f9f7] overflow-hidden">
        <Sidebar role={role} userName={userName} clubName={clubName} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <DashboardTopbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="max-w-[1100px] mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

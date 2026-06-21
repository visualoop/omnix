/**
 * People hub — /people
 *
 * Front door to everything HR-shaped: employees, attendance, leave,
 * payroll. Each existing page renders unchanged inside the active tab.
 * Existing /hr/* routes still work as direct links.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  CalendarX as CalendarOff,
  Clock,
  Money as Banknote,
  Users,
} from "@phosphor-icons/react";
import { HubLayout } from "@/components/layout/hub-layout";
import { EmployeesPage } from "@/pages/employees";
import { AttendancePage } from "@/pages/attendance";
import { LeavePage } from "@/pages/leave";
import { PayrollPage } from "@/pages/payroll";

export function PeopleHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="HR"
      title="People"
      description="Track who works, when they work, and what they're paid."
      tabs={[
        { id: "employees", label: "Employees", icon: Users, component: EmployeesPage, permission: "hr.employees.view" },
        { id: "attendance", label: "Attendance", icon: Clock, component: AttendancePage, permission: "hr.attendance.view" },
        { id: "leave", label: "Leave", icon: CalendarOff, component: LeavePage, permission: "hr.leave.request" },
        { id: "payroll", label: "Payroll", icon: Banknote, component: PayrollPage, permission: "hr.payroll.view" },
      ]}
      hasPermission={has}
    />
  );
}

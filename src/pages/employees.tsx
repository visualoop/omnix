import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirm, prompt } from "@/components/ui/confirm-dialog";
import {
  Check,
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  Plus,
  Users,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import {
  listEmployees, listDepartments, upsertEmployee, terminateEmployee, reactivateEmployee, getNextEmployeeNumber,
  listLinkableUsers, type EmployeeWithDetails, type Employee, type Department, type LinkableUser,
} from "@/services/employees";
import { listBranches, type BranchWithStats } from "@/services/branches";
import { createUser, type User } from "@/services/auth";
import { calculatePayroll } from "@/services/payroll";
import { toast } from "sonner";
import { money } from "@/lib/money";

export function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, depts, brs] = await Promise.all([
        listEmployees({ search, active: showInactive ? undefined : true }),
        listDepartments(),
        listBranches(false),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setBranches(brs);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [search, showInactive]);

  const totalSalaryCost = employees
    .filter((e) => e.active === 1)
    .reduce((s, e) => s + e.base_salary, 0);

  const totalEmployerCost = employees
    .filter((e) => e.active === 1 && e.base_salary > 0)
    .reduce((s, e) => s + calculatePayroll({ base_salary: e.base_salary }).total_employer_cost, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Employees"
        description="Staff records, payroll, attendance, leave. Separate from system user accounts — an employee can exist without a login."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New employee
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Active employees" value={String(employees.filter((e) => e.active === 1).length)} />
        <Stat label="Monthly salary cost" value={money(totalSalaryCost)} />
        <Stat label="Total employer cost" value={money(totalEmployerCost)} hint="Incl. NSSF, Housing, NITA" />
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or phone..."
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Show terminated
        </label>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Job</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Branch</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Salary</th>
              <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={4} />
            ) : employees.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Users}
                  title="No employees yet"
                  description="Add staff records to manage payroll, attendance, and leave."
                  cta={{ label: "Add Employee", onClick: () => setCreating(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} className="border-b border-border/60 hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/hr/employees/${e.id}`)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary font-medium flex items-center justify-center text-xs shrink-0">
                        {e.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{e.full_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{e.employee_number}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium">{e.job_title}</div>
                    {e.department_name && <div className="text-muted-foreground text-[11px]">{e.department_name}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.branch_name || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {e.base_salary > 0 ? money(e.base_salary) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {e.active === 1 ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Terminated</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon-xs" onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EmployeeForm
        open={creating || !!editing}
        employee={editing}
        departments={departments}
        branches={branches}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold font-mono mt-1">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmployeeForm({ open, employee, departments, branches, onClose, onSaved }: {
  open: boolean;
  employee: Employee | null;
  departments: Department[];
  branches: BranchWithStats[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>({});
  const [users, setUsers] = useState<LinkableUser[]>([]);
  const [createLoginOpen, setCreateLoginOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [empNumber, setEmpNumber] = useState("");

  useEffect(() => {
    if (open) {
      if (employee) {
        setForm(employee);
        setEmpNumber(employee.employee_number);
      } else {
        setForm({
          active: 1,
          employment_type: "permanent",
          pay_type: "monthly",
          base_salary: 0,
          hire_date: new Date().toISOString().slice(0, 10),
        });
        getNextEmployeeNumber().then(setEmpNumber);
      }
      listLinkableUsers(employee?.id).then(setUsers);
    }
  }, [employee, open]);

  const save = async () => {
    if (!form.full_name || !form.job_title) {
      toast.error("Name and job title required");
      return;
    }
    setSubmitting(true);
    try {
      await upsertEmployee({
        ...form,
        full_name: form.full_name,
        job_title: form.job_title,
        employee_number: employee ? employee.employee_number : empNumber,
      });
      toast.success(employee ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Live payroll calc preview
  const payslip = form.base_salary && form.base_salary > 0
    ? calculatePayroll({ base_salary: form.base_salary })
    : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{employee ? employee.full_name : "New Employee"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="compensation">Compensation</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
            </TabsList>

            <TabsPanel value="profile" className="space-y-3 mt-3">
              <Field label="Employee #">
                <Input value={empNumber} disabled className="font-mono" />
              </Field>
              <Field label="Full Name *">
                <Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="National ID">
                  <Input value={form.id_number || ""} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                </Field>
              </div>
              <Field label="Gender">
                <select
                  value={form.gender || ""}
                  onChange={(e) => setForm({ ...form, gender: (e.target.value || null) as any })}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone">
                  <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
              <Field label="Address">
                <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="border-t border-border pt-3 space-y-3 mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next of Kin</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Name">
                    <Input value={form.next_of_kin_name || ""} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} />
                  </Field>
                  <Field label="Relationship">
                    <Input value={form.next_of_kin_relationship || ""} onChange={(e) => setForm({ ...form, next_of_kin_relationship: e.target.value })} placeholder="Spouse, Parent, Sibling" />
                  </Field>
                </div>
                <Field label="Phone">
                  <Input value={form.next_of_kin_phone || ""} onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })} />
                </Field>
              </div>
            </TabsPanel>

            <TabsPanel value="employment" className="space-y-3 mt-3">
              <Field label="System User Account" hint="Optional. Link only staff who need to log in to Omnix.">
                <div className="flex gap-2">
                  <select
                    value={form.user_id || ""}
                    onChange={(e) => setForm({ ...form, user_id: e.target.value || null })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                  >
                    <option value="">No login access</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} (@{u.username}) - {u.role}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCreateLoginOpen(true)}>
                    Create
                  </Button>
                </div>
              </Field>
              <Field label="Job Title *">
                <Input value={form.job_title || ""} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Department">
                  <select
                    value={form.department_id || ""}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value || null })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                  >
                    <option value="">—</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Branch">
                  <select
                    value={form.branch_id || ""}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value || null })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                  >
                    <option value="">—</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type">
                  <select
                    value={form.employment_type || "permanent"}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value as any })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                  >
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="casual">Casual</option>
                    <option value="intern">Intern</option>
                  </select>
                </Field>
                <Field label="Hire date *">
                  <Input type="date" value={form.hire_date || ""} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
                </Field>
              </div>
              {employee && employee.active === 1 && (
                <Button
                  variant="ghost"
                  className="w-full text-red-600 mt-2"
                  onClick={async () => {
                    const reason = (await prompt({ title: "Reason for termination?" })) || "";
                    if (!reason) return;
                    if (!(await confirm({ title: `Terminate ${employee.full_name}?` }))) return;
                    await terminateEmployee(employee.id, reason);
                    toast.success("Employee terminated");
                    onSaved();
                  }}
                >
                  Terminate Employment
                </Button>
              )}
              {employee && employee.active === 0 && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={async () => {
                    await reactivateEmployee(employee.id);
                    toast.success("Reactivated");
                    onSaved();
                  }}
                >
                  Reactivate
                </Button>
              )}
            </TabsPanel>

            <TabsPanel value="compensation" className="space-y-3 mt-3">
              <Field label="Pay Type">
                <select
                  value={form.pay_type || "monthly"}
                  onChange={(e) => setForm({ ...form, pay_type: e.target.value as any })}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                >
                  <option value="monthly">Monthly Salary</option>
                  <option value="daily">Daily Wage</option>
                  <option value="hourly">Hourly</option>
                  <option value="piece_rate">Piece Rate</option>
                  <option value="commission_only">Commission Only</option>
                </select>
              </Field>
              <Field label="Base Salary (KES / month)">
                <Input
                  type="number"
                  value={form.base_salary || 0}
                  onChange={(e) => setForm({ ...form, base_salary: parseFloat(e.target.value) || 0 })}
                />
              </Field>
              {form.pay_type === "daily" && (
                <Field label="Daily Rate">
                  <Input type="number" value={form.daily_rate || 0} onChange={(e) => setForm({ ...form, daily_rate: parseFloat(e.target.value) || null })} />
                </Field>
              )}
              {form.pay_type === "hourly" && (
                <Field label="Hourly Rate">
                  <Input type="number" value={form.hourly_rate || 0} onChange={(e) => setForm({ ...form, hourly_rate: parseFloat(e.target.value) || null })} />
                </Field>
              )}
              <Field label="Commission Rate (% of sales)">
                <Input
                  type="number"
                  value={form.commission_rate || 0}
                  onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || null })}
                  placeholder="0 if not on commission"
                />
              </Field>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <Field label="KRA PIN">
                  <Input value={form.kra_pin || ""} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} className="font-mono" />
                </Field>
                <Field label="NSSF #">
                  <Input value={form.nssf_number || ""} onChange={(e) => setForm({ ...form, nssf_number: e.target.value })} className="font-mono" />
                </Field>
                <Field label="SHIF #">
                  <Input value={form.shif_number || ""} onChange={(e) => setForm({ ...form, shif_number: e.target.value })} className="font-mono" />
                </Field>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={(form as any).is_pharmacist === 1}
                    onChange={(e) => setForm({ ...form, is_pharmacist: e.target.checked ? 1 : 0 } as any)}
                    className="rounded"
                  />
                  <span>Registered Pharmacist (PPB licensed)</span>
                </label>
                {(form as any).is_pharmacist === 1 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Field label="PPB License #">
                      <Input
                        value={(form as any).pharmacist_license_number || ""}
                        onChange={(e) => setForm({ ...form, pharmacist_license_number: e.target.value } as any)}
                        className="font-mono"
                        placeholder="P/2024/12345"
                      />
                    </Field>
                    <Field label="License Expiry">
                      <Input
                        type="date"
                        value={(form as any).pharmacist_license_expiry || ""}
                        onChange={(e) => setForm({ ...form, pharmacist_license_expiry: e.target.value } as any)}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {payslip && (
                <Card className="mt-3">
                  <CardContent className="p-3 text-xs space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Monthly Take-home Estimate</div>
                    <Row label="Gross" value={payslip.gross_pay} />
                    <Row label="- PAYE" value={-payslip.paye} />
                    <Row label="- NSSF" value={-payslip.nssf_employee} />
                    <Row label="- SHIF" value={-payslip.shif} />
                    <Row label="- Housing levy" value={-payslip.housing_levy_employee} />
                    <div className="border-t border-border pt-1 font-semibold">
                      <Row label="Net pay" value={payslip.net_pay} />
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-1">
                      Total cost to employer: KES {payslip.total_employer_cost.toFixed(0)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsPanel>

            <TabsPanel value="bank" className="space-y-3 mt-3">
              <Field label="Bank Name">
                <Input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g., KCB, Equity, Co-op" />
              </Field>
              <Field label="Account Number">
                <Input value={form.bank_account || ""} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Branch">
                <Input value={form.bank_branch || ""} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} />
              </Field>
              <div className="border-t border-border pt-3 mt-3">
                <Field label="M-Pesa Number" hint="If paid via M-Pesa instead of bank">
                  <Input value={form.paybill_or_phone || ""} onChange={(e) => setForm({ ...form, paybill_or_phone: e.target.value })} placeholder="0700 000 000" />
                </Field>
              </div>
            </TabsPanel>
          </Tabs>
        </div>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </SheetFooter>
      </SheetContent>
      <CreateLoginSheet
        open={createLoginOpen}
        employeeName={form.full_name || ""}
        employeeEmail={form.email || ""}
        onClose={() => setCreateLoginOpen(false)}
        onCreated={async (user) => {
          setForm((prev) => ({ ...prev, user_id: user.id }));
          setUsers(await listLinkableUsers(employee?.id));
          setCreateLoginOpen(false);
        }}
      />
    </Sheet>
  );
}

function CreateLoginSheet({ open, employeeName, employeeEmail, onClose, onCreated }: {
  open: boolean;
  employeeName: string;
  employeeEmail: string;
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("cashier");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(employeeName);
    setUsername((employeeEmail.split("@")[0] || employeeName.toLowerCase().replace(/[^a-z0-9]+/g, ".")).replace(/^\.+|\.+$/g, ""));
    setPassword("");
    setRole("cashier");
  }, [employeeEmail, employeeName, open]);

  const save = async () => {
    if (!username || !fullName || !password) {
      toast.error("Username, name, and password are required");
      return;
    }
    setSaving(true);
    try {
      const user = await createUser({ username, full_name: fullName, password, role });
      toast.success("User account created");
      onCreated(user);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Create User Account</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          <Field label="Full Name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as User["role"])}>
              <SelectTrigger className="w-full h-8 text-[13px]">
                <SelectValue placeholder="Pick a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Temporary Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create & Link
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{Math.abs(value).toFixed(2)}</span>
    </div>
  );
}

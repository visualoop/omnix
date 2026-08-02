import { AccountDeviceCard } from "@/components/mobile/AccountDeviceCard";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { accountInitials } from "@/mobile/models/account-device";
import type {
  MobileProfileAction,
  MobileProfileModel,
} from "@/mobile/models/profile";
import type { AdapterAvailability, NativePermissionState } from "@/platform/adapters";

export interface MobileProfileProps {
  readonly model: MobileProfileModel;
  readonly onSelectBranch: (branchId: string) => void;
  readonly onAction: (action: MobileProfileAction) => void;
  readonly onSignOut: () => void;
  readonly meshAvailability?: AdapterAvailability;
  readonly meshActionPending?: boolean;
}

function permissionStateLabel(state: NativePermissionState): string {
  if (state === "granted") return "Allowed";
  if (state === "denied") return "Blocked";
  if (state === "prompt") return "Not requested";
  if (state === "restricted") return "Restricted by device";
  return "Unavailable";
}

function biometricStateLabel(model: MobileProfileModel): string {
  const security = model.accountDevice.security;
  if (security.biometricStatus.state === "unavailable") return "Unavailable";
  if (security.biometricStatus.state === "permission-required") return "Permission needed";
  if (security.biometricEnrolled) return "Enabled";
  return "Available, not enrolled";
}

function moduleLabel(module: string): string {
  if (module === "core") return "Core";
  if (module === "dawa") return "Dawa";
  if (module === "retail") return "Soko Retail";
  if (module === "hardware") return "Hardware & Equipment";
  if (module === "hospitality") return "Hospitality";
  if (module === "salon") return "Salon / Spa";
  return module;
}

function formatTimestamp(value: string, locale: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function MobileProfile({
  model,
  onSelectBranch,
  onAction,
  onSignOut,
  meshAvailability = { state: "available" },
  meshActionPending = false,
}: MobileProfileProps) {
  const account = model.accountDevice.account;
  const security = model.accountDevice.security;
  const recentActivity = model.accountDevice.activity.slice(0, 5);

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 py-2" aria-labelledby="mobile-profile-title">
        <div
          className="grid size-14 shrink-0 place-items-center rounded-md bg-primary text-lg font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {accountInitials(account)}
        </div>
        <div className="min-w-0">
          <h1 id="mobile-profile-title" className="truncate text-xl font-semibold tracking-tight">
            {account.fullName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">@{account.username}</span>
            <Badge variant="secondary">{account.role}</Badge>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Identity & contact</h2>
          <Badge variant="outline">Account</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="max-w-52 truncate text-right">{account.email ?? "Not provided"}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-mono text-xs">{account.phone ?? "Not provided"}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{account.role}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Branch access</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Changing branch changes every operational screen.
            </p>
          </div>
          <Badge variant="outline">{model.currency}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Assigned and active branch
            </p>
            <Combobox
              value={model.branches.find((branch) => branch.isActive)?.id ?? ""}
              onChange={onSelectBranch}
              options={model.branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
                hint: branch.code,
                description: branch.isPrimary ? "Primary branch" : "Assigned branch",
              }))}
              placeholder="All branches — analytics only"
              searchPlaceholder="Search assigned branches…"
              emptyText="No assigned branch matches"
              className="mt-2"
            />
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-[13px]">
            <div>
              <dt className="text-muted-foreground">Active scope</dt>
              <dd className="mt-1 font-medium">{model.scopeLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Market</dt>
              <dd className="mt-1 font-medium">{model.country} · {model.currency}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Role access</h2>
          <Badge variant="outline">{model.permissions.length} permissions</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium">Assigned modules</p>
            {model.modules.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {model.modules.map((module) => (
                  <Badge key={module} variant="secondary" className="normal-case tracking-normal">
                    {moduleLabel(module)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No modules assigned.</p>
            )}
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium">Operational permissions</p>
            {model.permissions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {model.permissions.map((permission) => (
                  <Badge key={permission} variant="outline" className="normal-case tracking-normal">
                    {permission}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No operational permissions assigned.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Sign-in & permissions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Actions open the protected Android prompt; this screen never collects sign-in details.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Biometric unlock</dt>
            <dd>{biometricStateLabel(model)}</dd>
            <dt className="text-muted-foreground">Biometric permission</dt>
            <dd>{permissionStateLabel(security.biometricPermission)}</dd>
            <dt className="text-muted-foreground">Notifications</dt>
            <dd>{permissionStateLabel(security.notificationPermission)}</dd>
          </dl>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => onAction("change-password")}>
              Change password
            </Button>
            <Button type="button" variant="outline" onClick={() => onAction("change-pin")}>
              Change PIN
            </Button>
            {security.biometricPermission !== "granted" || !security.biometricEnrolled ? (
              <Button type="button" variant="outline" onClick={() => onAction("request-biometric")}>
                Set up biometrics
              </Button>
            ) : null}
            {security.notificationPermission !== "granted" ? (
              <Button type="button" variant="outline" onClick={() => onAction("request-notifications")}>
                Allow notifications
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AccountDeviceCard
        model={model.accountDevice}
        locale={model.locale}
        meshEnrollmentReady={model.meshEnrollmentReady}
        meshAvailability={meshAvailability}
        meshActionPending={meshActionPending}
        onMeshAction={() => onAction(
          model.accountDevice.mesh.state === "connected"
            ? "disconnect-private-mesh"
            : "connect-private-mesh",
        )}
      />

      <Card>
        <CardHeader>
          <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Recent device activity</h2>
          <Badge variant="outline">Latest {recentActivity.length}</Badge>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <ol className="divide-y divide-border">
              {recentActivity.map((event) => (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      {event.detail ? (
                        <p className="mt-1 text-xs leading-4 text-muted-foreground">{event.detail}</p>
                      ) : null}
                    </div>
                    <time
                      dateTime={event.occurredAt}
                      className="shrink-0 font-mono text-[10px] text-muted-foreground"
                    >
                      {formatTimestamp(event.occurredAt, model.locale)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity on this device.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight leading-tight">Device access</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Clear local cache, refresh enrollment, or remove this device from the account.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button type="button" variant="outline" onClick={() => onAction("clear-cache")}>
            Clear local cache
          </Button>
          <Button type="button" variant="outline" onClick={() => onAction("re-enrol-device")}>
            Re-enrol this device
          </Button>
          <Button type="button" variant="destructive" onClick={() => onAction("revoke-device")}>
            Revoke this device
          </Button>
        </CardContent>
      </Card>

      <Button type="button" variant="destructive" className="w-full" onClick={onSignOut}>
        Sign out on this device
      </Button>
    </div>
  );
}

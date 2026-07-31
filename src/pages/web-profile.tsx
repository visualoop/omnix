import { Buildings, Clock, Desktop, IdentificationCard, LockKey, PlugsConnected } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { ProfileProjection, ReadonlyWebSession } from "@/web/contracts";

interface WebProfilePageProps {
  readonly profile: ProfileProjection;
  readonly session: ReadonlyWebSession;
}

export function WebProfilePage({ profile, session }: WebProfilePageProps) {
  const summary = [
    { label: "Role", value: profile.roleLabel, icon: IdentificationCard },
    { label: "Device", value: profile.deviceLabel, icon: Desktop },
    { label: "Connected hub", value: profile.connectedHubName, icon: PlugsConnected },
    { label: "Session expires", value: profile.sessionExpiresAt, icon: Clock },
  ] as const;

  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">Authenticated session</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{profile.displayName}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline"><LockKey aria-hidden="true" /> Read only</Badge>
          <Badge variant="secondary" className="capitalize">{session.role}</Badge>
        </div>
      </header>

      <section aria-label="Session summary" className="grid grid-cols-1 border-l border-t border-border sm:grid-cols-2">
        {summary.map((item) => (
          <div key={item.label} className="flex min-h-24 items-start gap-3 border-b border-r border-border p-4">
            <item.icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-2 break-words font-mono text-sm font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="assigned-branches-title">
        <div className="flex items-center gap-2">
          <Buildings className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="assigned-branches-title" className="text-base font-semibold">Assigned branches</h2>
        </div>
        <div className="mt-3 divide-y divide-border border-y border-border">
          {profile.assignedBranches.map((branch) => (
            <div key={branch.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">{branch.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{branch.id}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="permissions-title">
        <h2 id="permissions-title" className="text-base font-semibold">Report permissions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.permissions.map((permission) => <Badge key={permission} variant="outline">{permission}</Badge>)}
        </div>
      </section>

      <footer className="border-t border-border pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Session {session.sessionId} · Issued {profile.sessionIssuedAt}
      </footer>
    </div>
  );
}

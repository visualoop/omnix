import { useEffect, useMemo, useState } from "react";
import { Copy, Trash as Trash2 } from "@phosphor-icons/react";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { listUsers, type User } from "@/services/auth";
import {
  issueReadOnlyWebAuthorization,
  listReadOnlyWebAuthorizations,
  revokeReadOnlyWebAuthorization,
  type BrowserSessionAdminRow,
  type IssuedBrowserAuthorization,
} from "@/services/network";
import { useAuthStore } from "@/stores/auth";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

interface BrowserViewerPanelProps {
  readOnlyUrl: string;
}

const SESSION_DURATIONS = [
  { seconds: 60 * 60, label: "1 hour" },
  { seconds: 4 * 60 * 60, label: "4 hours" },
  { seconds: 8 * 60 * 60, label: "8 hours" },
] as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleString(intlLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BrowserViewerPanel({ readOnlyUrl }: BrowserViewerPanelProps) {
  const administrator = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<BrowserSessionAdminRow[]>([]);
  const [userId, setUserId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState(4 * 60 * 60);
  const [issued, setIssued] = useState<IssuedBrowserAuthorization | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!administrator) return;
    const [availableUsers, currentSessions] = await Promise.all([
      listUsers(),
      listReadOnlyWebAuthorizations(administrator.id),
    ]);
    const eligible = availableUsers.filter(
      (user) => user.active === 1 && user.role !== "cashier",
    );
    setUsers(eligible);
    setSessions(currentSessions);
    setUserId((current) => current || eligible[0]?.id || "");
  };

  useEffect(() => {
    void load().catch((error) => toast.error(`Browser access could not be loaded: ${String(error)}`));
  }, [administrator?.id]);

  const filteredSessions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) =>
      `${session.displayName} ${session.deviceLabel} ${session.state}`.toLowerCase().includes(needle),
    );
  }, [search, sessions]);
  const { pageRows, pagination } = useClientPagination(filteredSessions, 8, search);

  const issue = async () => {
    if (!administrator || !userId || !deviceLabel.trim()) return;
    setBusy(true);
    try {
      const authorization = await issueReadOnlyWebAuthorization({
        administratorUserId: administrator.id,
        userId,
        deviceLabel: deviceLabel.trim(),
        ttlSeconds,
      });
      setIssued(authorization);
      setDeviceLabel("");
      await load();
      toast.success("Browser viewer authorized");
    } catch (error) {
      toast.error(String(error).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const revoke = async (session: BrowserSessionAdminRow) => {
    if (!administrator) return;
    await revokeReadOnlyWebAuthorization(administrator.id, session.id);
    await load();
    toast.success("Browser access revoked");
  };

  return (
    <section className="border-y border-border py-5" aria-labelledby="browser-viewers-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Read-only companion</p>
          <h3 id="browser-viewers-title" className="mt-1 text-sm font-semibold">Browser viewers</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            Authorize one browser against an existing user. Branches and report access are fixed when the code is issued.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => copy(`${readOnlyUrl}/web/login`, "Login address copied")}>
          <Copy className="mr-1.5 size-3.5" /> Copy login address
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Viewer account">
          <Combobox
            value={userId}
            onChange={setUserId}
            options={users.map((user) => ({ value: user.id, label: user.full_name, hint: user.role }))}
            placeholder="Choose an account"
            searchPlaceholder="Search users…"
            emptyText="Create and assign a reporting user first."
          />
        </Field>
        <Field label="Browser label">
          <Input
            value={deviceLabel}
            onChange={(event) => setDeviceLabel(event.target.value.slice(0, 120))}
            placeholder="e.g. Owner’s iPad"
            maxLength={120}
          />
        </Field>
        <Field label="Access duration">
          <select
            value={ttlSeconds}
            onChange={(event) => setTtlSeconds(Number(event.target.value))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/30"
          >
            {SESSION_DURATIONS.map((duration) => (
              <option key={duration.seconds} value={duration.seconds}>{duration.label}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <Button className="w-full active:scale-[0.98]" onClick={issue} disabled={busy || !userId || !deviceLabel.trim()}>
            {busy ? "Authorizing…" : "Issue one-time code"}
          </Button>
        </div>
      </div>

      {issued && (
        <div className="mt-5 border-l-2 border-blue-600 bg-blue-500/5 px-4 py-4" role="status">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium">Code for {issued.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Enter it at <span className="font-mono">{readOnlyUrl}/web/login</span>. It works once and expires at {formatDate(issued.grantExpiresAt)}.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copy(issued.authorizationCode, "Authorization code copied")}>
              <Copy className="mr-1.5 size-3.5" /> Copy code
            </Button>
          </div>
          <p className="mt-4 break-all font-mono text-lg font-semibold tracking-[0.12em] text-blue-700 dark:text-blue-300">
            {issued.authorizationCode}
          </p>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent browser access</h4>
            <p className="mt-1 text-xs text-muted-foreground">Revoke an active session to stop its next request.</p>
          </div>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search viewer or browser"
            aria-label="Search browser sessions"
            className="w-full sm:w-64"
          />
        </div>
        {pageRows.length === 0 ? (
          <div className="mt-4 border-y border-border py-6 text-center text-xs text-muted-foreground">
            No browser authorizations match this search. Issue a code above to add one.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border border-y border-border">
            {pageRows.map((session) => (
              <div key={`${session.id}-${session.state}`} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.displayName} <span className="font-normal text-muted-foreground">/ {session.deviceLabel}</span></p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{session.state} · expires {formatDate(session.expiresAt)}</p>
                </div>
                {!session.revokedAt && !["expired", "redeemed", "revoked"].includes(session.state) && (
                  <Button variant="ghost" size="sm" onClick={() => void revoke(session)} aria-label={`Revoke ${session.deviceLabel}`}>
                    <Trash2 className="size-3.5 text-red-600" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <PaginationBar list={pagination} />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

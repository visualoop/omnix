/**
 * Settings → Licences
 *
 * Editorial layout (PageHeader → list → composer). One row per licence
 * the user has activated on this PC. Each row shows variant + tier +
 * status + sync state. Active workspace pointer pinned per row via the
 * sidebar's module switcher — set here via "Switch to this".
 *
 * Actions:
 *   - Add another licence (paste a key + click Activate)
 *   - Re-sync licences (POST every key to /api/licensing/sync)
 *   - Switch active module (sets settings.local_licenses.active_key
 *     + reloads the page)
 *   - Remove from this PC (deletes the local row; does NOT release the
 *     server-side seat — use omnix.co.ke/dashboard/machines for that)
 */
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  CheckCircle,
  ArrowsClockwise,
  Plus,
  Trash,
  Key,
  WarningCircle,
} from "@phosphor-icons/react"
import {
  listLocalLicenses,
  activateLicense,
  syncLicenses,
  removeLocalLicense,
  getActiveLicenseKey,
  setActiveLicenseKey,
  type LocalLicense,
  type LicenseVariant,
} from "@/services/local-licenses"
import { query, execute } from "@/lib/db"
import { getMachineInfo } from "@/services/license"
import { VARIANT } from "@/lib/variant"
import { confirm } from "@/components/ui/confirm-dialog"

/** Detect variant from a compact key prefix. Falls back to 'pro' when unclear. */
function detectVariantFromKey(key: string): LicenseVariant {
  const parts = key.replace(/\s+/g, "").toUpperCase().split("-")
  if (parts[0] !== "OMNIX" || parts.length < 2) return "pro"
  const tag = parts[1]
  if (tag === "RETAIL") return "retail"
  if (tag === "DAWA") return "dawa"
  if (tag === "HOSP" || tag === "HOSPITALITY") return "hospitality"
  if (tag === "HW" || tag === "HARDWARE") return "hardware"
  return "pro"
}

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  foreign: "Wrong account",
  orphan_payload: "Unknown key",
  seat_taken: "All seats used",
  recreated: "Recovered",
  pending: "Pending sync",
}

const STATUS_TONE: Record<string, string> = {
  verified: "text-emerald-600",
  foreign: "text-rose-700",
  orphan_payload: "text-amber-700",
  seat_taken: "text-amber-700",
  recreated: "text-emerald-600",
  pending: "text-muted-foreground",
}

export function SettingsLicensesPage() {
  const [licenses, setLicenses] = useState<LocalLicense[]>([])
  const [activeKey, setActive] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [emailSaved, setEmailSaved] = useState(false)
  const [draftKey, setDraftKey] = useState("")
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [rows, active, savedEmail] = await Promise.all([
      listLocalLicenses(),
      getActiveLicenseKey(),
      query<{ value: string }>(
        `SELECT value FROM settings WHERE key = 'licensing.owner_email'`,
      ).then((r) => r[0]?.value || ""),
    ])

    // Backfill: if local_licenses is empty but the singleton `license`
    // row is populated (legacy setup wizard path pre-v0.27.3 didn't
    // populate local_licenses), copy it in so the UI shows what's
    // actually installed on this PC. Otherwise the user sees "no
    // licences" even though the app is running fine on an active key.
    let finalRows = rows
    if (finalRows.length === 0) {
      try {
        const legacy = await query<{
          license_key: string
          license_kid: string | null
          license_type: string | null
          modules_json: string | null
          max_devices: number | null
          maintenance_expires_at: string | null
          activated_at: string
        }>(
          `SELECT license_key, license_kid, license_type, modules_json,
                  max_devices, maintenance_expires_at, activated_at
           FROM license WHERE id = 'active'`,
        )
        if (legacy[0]) {
          const l = legacy[0]
          const variant = detectVariantFromKey(l.license_key)
          await execute(
            `INSERT OR IGNORE INTO local_licenses (
              license_key, license_id, variant, tier, status,
              signed_key, modules, max_machines, max_branches,
              auth_token, auth_token_hash,
              last_synced_at, sync_status, sync_message,
              trial_ends_at, maintenance_until,
              activated_at, last_verified_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, 1, NULL, NULL,
                      NULL, 'verified', NULL, NULL, ?8, ?9, ?9)`,
            [
              l.license_key,
              l.license_kid ?? l.license_key,
              variant,
              l.license_type === 'perpetual' ? 'paid' : 'trial',
              'active',
              l.modules_json ?? JSON.stringify([variant]),
              l.max_devices ?? 1,
              l.maintenance_expires_at,
              l.activated_at,
            ],
          )
          // Also point the active-key pointer at it so switch UI shows this row highlighted.
          if (!active) await setActiveLicenseKey(l.license_key)
          finalRows = await listLocalLicenses()
        }
      } catch (e) {
        console.warn('[settings-licenses] backfill from singleton failed:', e)
      }
    }

    setLicenses(finalRows)
    setActive(await getActiveLicenseKey())
    setEmail(savedEmail)
    setEmailSaved(!!savedEmail)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const saveEmail = async () => {
    if (!email.trim()) {
      toast.error("Enter the email tied to your omnix.co.ke account")
      return
    }
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('licensing.owner_email', ?1, 'licensing')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [email.trim().toLowerCase()],
    )
    setEmailSaved(true)
    toast.success("Email saved")
  }

  const handleAdd = async () => {
    if (!draftKey.trim()) {
      toast.error("Paste a licence key first")
      return
    }
    setAdding(true)
    try {
      // Auto-save email if entered but not yet saved (nice UX).
      // If empty, we still activate — the server treats email as optional metadata.
      if (email.trim() && !emailSaved) {
        await saveEmail()
      }
      const machineId = await getMachineInfo().then((i) => i.fingerprint).catch(() => "")
      const result = await activateLicense({
        licenseKey: draftKey.trim().toUpperCase(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        machineId,
        // Tell the server which binary is asking. The new gate 2.5
        // (variant_mismatch) rejects e.g. a Hospitality key on the
        // Retail installer. Pro keys are wildcards.
        variant: VARIANT,
      })
      if (!result.ok) {
        toast.error(result.error ?? "Activation failed")
        return
      }
      toast.success("Licence added")
      setDraftKey("")
      await load()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setAdding(false)
    }
  }

  const handleResync = async () => {
    if (!email.trim()) {
      toast.error("Save your account email first")
      return
    }
    setSyncing(true)
    try {
      const machineId = await getMachineInfo().then((i) => i.fingerprint).catch(() => "")
      const results = await syncLicenses(email.trim().toLowerCase(), machineId)
      const verified = results.filter((r) => r.status === "verified").length
      const trouble = results.length - verified
      if (trouble > 0) toast.warning(`${trouble} licence${trouble === 1 ? "" : "s"} need attention`)
      else if (verified > 0) toast.success(`${verified} licence${verified === 1 ? "" : "s"} verified`)
      else toast.info("No licences to sync yet")
      await load()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSyncing(false)
    }
  }

  const handleSwitch = async (key: string) => {
    await setActiveLicenseKey(key)
    setActive(key)
    toast.success("Active module switched. Reloading…")
    // Hard reload so every store + sidebar picks up the new active module.
    setTimeout(() => window.location.reload(), 600)
  }

  const handleRemove = async (key: string) => {
    const ok = await confirm({
      title: "Remove this licence from this PC?",
      description: `${key}\n\nThe key stays on your account. It just stops activating on this machine. Run "Re-sync licences" to bring it back.`,
      confirmText: "Remove",
      variant: "destructive",
    })
    if (!ok) return
    await removeLocalLicense(key)
    toast.success("Removed from this PC")
    await load()
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading licences…</div>

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <PageHeader
        back={{ fallback: "/settings" }}
        eyebrow="Settings"
        title="Licences"
        description="Every licence active on this computer. Switch modules without re-installing. Add a key any time."
        actions={
          <Button onClick={handleResync} variant="outline" size="sm" disabled={syncing || !email.trim()}>
            <ArrowsClockwise className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Re-sync licences"}
          </Button>
        }
      />

      {/* Owner email — required for sync to know which account the keys
          belong to. Stored locally only. */}
      <section className="flex flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Account email
          </span>
          {emailSaved ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-600">
              <CheckCircle className="h-3 w-3" />
              Saved
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailSaved(false)
            }}
            placeholder="you@example.com"
            className="flex-1"
          />
          <Button size="sm" onClick={saveEmail} disabled={!email.trim() || emailSaved}>
            Save
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted-foreground max-w-[60ch]">
          The email you used to sign up on omnix.co.ke. We need it so the cloud knows
          which account owns the licences on this computer. Stored locally — never sent
          anywhere except during a sync check.
        </p>
      </section>

      {/* Active licences list */}
      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Licences on this PC
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            {licenses.length} total
          </span>
        </header>

        {licenses.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center text-[13px] text-muted-foreground">
            No licences on this PC yet. Paste a key below to activate.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {licenses.map((l) => {
              const isActive = activeKey === l.license_key
              const syncStatus = l.sync_status ?? "pending"
              return (
                <li
                  key={l.license_key}
                  className={`flex items-center gap-3 rounded-md border p-3 ${
                    isActive
                      ? "border-foreground/40 bg-foreground/[0.03]"
                      : "border-foreground/10 bg-foreground/[0.01]"
                  }`}
                >
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-[12px] tabular-nums truncate">{l.license_key}</code>
                      {isActive ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.22em] rounded-md border border-foreground/30 px-1.5 py-0.5">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="uppercase tracking-[0.12em]">{l.variant}</span>
                      <span>·</span>
                      <span>{l.tier}</span>
                      <span>·</span>
                      <span className={STATUS_TONE[syncStatus] ?? ""}>
                        {STATUS_LABEL[syncStatus] ?? syncStatus}
                      </span>
                    </div>
                    {l.sync_message ? (
                      <div className="mt-1 inline-flex items-start gap-1 text-[11px] text-amber-700 leading-[1.5]">
                        <WarningCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{l.sync_message}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isActive ? (
                      <Button size="sm" variant="outline" onClick={() => handleSwitch(l.license_key)}>
                        Switch to this
                      </Button>
                    ) : null}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleRemove(l.license_key)}
                      title="Remove from this PC"
                      className="h-8 w-8"
                    >
                      <Trash className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Add another licence */}
      <section className="flex flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Add another licence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value.toUpperCase())}
            placeholder="OMNIX-XXXX-XXXX-XXXX-XXXX"
            className="flex-1 font-mono"
          />
          <Button onClick={handleAdd} disabled={adding || !draftKey.trim()}>
            {adding ? "Activating…" : "Activate"}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted-foreground max-w-[60ch]">
          Paste any licence key from your <a href="https://omnix.co.ke/dashboard/licenses" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">omnix.co.ke dashboard</a>. The seven activation gates run on the server — duplicate-variant + Pro/trade conflicts get rejected with a clear message.
        </p>
      </section>
    </div>
  )
}

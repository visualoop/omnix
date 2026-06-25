/**
 * Module switcher pinned to the sidebar.
 *
 * Renders nothing when the PC has 0 or 1 installed licences. With 2+
 * licences it shows a dropdown — picking a row sets the active licence
 * key and hard-reloads the app so every store + the active-module
 * sidebar repopulates from the new licence's entitlements.
 *
 * Pro is listed as a single row that covers all four trades; trade
 * variants get their own row each. The dropdown rejects switching into
 * a licence that isn't `sync_status = 'verified'` to avoid the user
 * landing inside a workspace they can't legally use.
 */
import { useEffect, useState } from "react"
import { CaretDown, Check } from "@phosphor-icons/react"
import {
  listLocalLicenses,
  getActiveLicenseKey,
  setActiveLicenseKey,
  type LocalLicense,
} from "@/services/local-licenses"

const VARIANT_LABEL: Record<string, string> = {
  pro: "Pro · all trades",
  dawa: "Dawa · pharmacy",
  retail: "Retail · shops",
  hardware: "Hardware · stores",
  hospitality: "Hospitality · venues",
}

export function ModuleSwitcher() {
  const [licenses, setLicenses] = useState<LocalLicense[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([listLocalLicenses(), getActiveLicenseKey()]).then(([rows, key]) => {
      if (!alive) return
      setLicenses(rows)
      setActiveKey(key)
    })
    return () => {
      alive = false
    }
  }, [])

  // Single-licence (or none) — keep the sidebar minimal, no switcher.
  if (licenses.length < 2) return null

  const active =
    licenses.find((l) => l.license_key === activeKey) ?? licenses[0]

  const handlePick = async (key: string) => {
    if (key === activeKey) {
      setOpen(false)
      return
    }
    await setActiveLicenseKey(key)
    // Hard reload — guarantees entitlements + active-module + sidebar
    // refresh from a clean slate. Same trick we use after a licence
    // upgrade so we don't have to thread reloads through every store.
    window.location.reload()
  }

  return (
    <div className="px-2 py-2 border-b border-border/60 relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-left hover:bg-foreground/[0.03] transition-colors"
      >
        <div className="flex flex-col gap-0 min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground leading-tight">
            Active licence
          </span>
          <span className="text-[12px] font-medium truncate">
            {VARIANT_LABEL[active.variant] ?? active.variant}
          </span>
        </div>
        <CaretDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-2 right-2 top-full mt-1 z-40 rounded-md border border-border bg-background shadow-md py-1 overflow-hidden">
            {licenses.map((l) => {
              const isActive = l.license_key === activeKey
              const verified = l.sync_status === "verified"
              return (
                <button
                  key={l.license_key}
                  type="button"
                  onClick={() => verified && handlePick(l.license_key)}
                  disabled={!verified}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                    verified
                      ? "hover:bg-foreground/[0.04] cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  } ${isActive ? "bg-foreground/[0.03]" : ""}`}
                  title={
                    verified
                      ? undefined
                      : "This licence hasn't synced yet — run Settings → Licences → Re-sync first"
                  }
                >
                  <span className="flex-1 min-w-0 truncate">
                    {VARIANT_LABEL[l.variant] ?? l.variant}
                  </span>
                  {isActive ? <Check className="h-3 w-3 shrink-0" /> : null}
                </button>
              )
            })}
            <div className="border-t border-border/60 mt-1 pt-1 px-2.5 pb-1">
              <a
                href="#/settings/licenses"
                onClick={() => setOpen(false)}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Manage licences →
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

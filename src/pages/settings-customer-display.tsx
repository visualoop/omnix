/**
 * Customer display settings page.
 * Controls what shows on the second-screen customer display.
 *
 * Privacy mode is PER MODULE — Dawa defaults to ON (medication-name privacy
 * required), retail / hospitality / hardware default to OFF (customers need
 * to see what they're paying for and what's coming from the kitchen).
 */
import { useEffect, useState } from "react";
import {
  Eye,
  Monitor,
  Receipt,
  User,
} from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { query, execute } from "@/lib/db";
import { openCustomerDisplay, closeCustomerDisplay, isCustomerDisplayOpen } from "@/lib/customer-display";
import { toast } from "sonner";

const MODULES = [
  { id: "core" as const, label: "Core (POS only)", defaultPrivacy: false },
  { id: "dawa" as const, label: "Dawa — Pharmacy", defaultPrivacy: true },
  { id: "retail" as const, label: "Retail (Soko)", defaultPrivacy: false },
  { id: "hardware" as const, label: "Hardware", defaultPrivacy: false },
  { id: "hospitality" as const, label: "Hospitality", defaultPrivacy: false },
];

export function CustomerDisplaySettingsPage() {
  const [privacyByModule, setPrivacyByModule] = useState<Record<string, boolean>>({});
  const [showTax, setShowTax] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const keys = MODULES.map((m) => `customer_display.privacy.${m.id}`)
      .concat(["customer_display.show_tax", "customer_display.show_customer"]);
    const placeholders = keys.map((_, i) => `?${i + 1}`).join(",");
    Promise.all([
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
        keys,
      ),
      isCustomerDisplayOpen(),
    ]).then(([rows, open]) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const pm: Record<string, boolean> = {};
      for (const m of MODULES) {
        const v = map[`customer_display.privacy.${m.id}`];
        pm[m.id] = v === undefined ? m.defaultPrivacy : v === "1";
      }
      setPrivacyByModule(pm);
      setShowTax(map["customer_display.show_tax"] !== "0");
      setShowCustomer(map["customer_display.show_customer"] !== "0");
      setDisplayOpen(open);
      setLoading(false);
    });
  }, []);

  const save = async (key: string, value: string) => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'customer_display')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value],
    );
  };

  const toggleDisplay = async () => {
    try {
      if (displayOpen) {
        await closeCustomerDisplay();
        setDisplayOpen(false);
        toast.success("Customer display closed");
      } else {
        await openCustomerDisplay();
        setDisplayOpen(true);
        toast.success("Customer display opened");
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Test Display
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Open a window on your second monitor to preview the customer-facing screen.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleDisplay}>
          {displayOpen ? "Close" : "Open"} Display
        </Button>
      </div>

      <div className="border-t border-border" />

      <div>
        <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
          <Eye className="h-4 w-4" /> Privacy mode (per module)
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          When ON, item names are hidden on the customer display for that module
          (e.g. for Dawa to keep medications private). Off elsewhere so the
          customer can confirm what's being prepared or rung up.
        </p>
        <div className="space-y-3 pl-6">
          {MODULES.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4">
              <div className="text-sm">{m.label}</div>
              <Switch
                checked={privacyByModule[m.id] ?? m.defaultPrivacy}
                onCheckedChange={(v) => {
                  setPrivacyByModule((p) => ({ ...p, [m.id]: v }));
                  save(`customer_display.privacy.${m.id}`, v ? "1" : "0");
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      <SettingToggle
        icon={Receipt}
        label="Show tax breakdown"
        description="Display tax line separately on totals."
        checked={showTax}
        onChange={(v) => { setShowTax(v); save("customer_display.show_tax", v ? "1" : "0"); }}
      />

      <SettingToggle
        icon={User}
        label="Show customer name"
        description="Show the selected customer name on the display."
        checked={showCustomer}
        onChange={(v) => { setShowCustomer(v); save("customer_display.show_customer", v ? "1" : "0"); }}
      />

      <div className="border-t border-border" />

      <PlaylistEditor />
    </div>
  );
}

interface PlaylistSlide {
  type: "image" | "video" | "iframe"
  url: string
  durationSeconds: number
}

function PlaylistEditor() {
  const [slides, setSlides] = useState<PlaylistSlide[]>([])
  const [draftUrl, setDraftUrl] = useState("")
  const [draftType, setDraftType] = useState<PlaylistSlide["type"]>("image")
  const [draftDuration, setDraftDuration] = useState(15)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'customer_display.playlist'`,
    )
      .then((rows) => {
        if (rows[0]?.value) {
          try {
            setSlides(JSON.parse(rows[0].value) as PlaylistSlide[])
          } catch {
            setSlides([])
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const persist = async (next: PlaylistSlide[]) => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('customer_display.playlist', ?1, 'customer_display')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify(next)],
    )
  }

  const addSlide = () => {
    if (!draftUrl.trim()) {
      toast.error("URL required")
      return
    }
    const next = [...slides, { type: draftType, url: draftUrl.trim(), durationSeconds: Math.max(3, draftDuration) }]
    setSlides(next)
    persist(next)
    setDraftUrl("")
  }

  const removeSlide = (idx: number) => {
    const next = slides.filter((_, i) => i !== idx)
    setSlides(next)
    persist(next)
  }

  if (loading) return null

  return (
    <div>
      <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
        <Monitor className="h-4 w-4" /> Idle playlist
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        When the cart is empty, rotate through these slides on the customer display.
        Use images for promos, YouTube embed URLs for video, or iframe URLs for live menus.
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {slides.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-[12px] font-mono">{s.type} · {s.durationSeconds}s</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[300px]">{s.url}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeSlide(i)}>Remove</Button>
          </div>
        ))}
        {slides.length === 0 && <p className="text-[12px] text-muted-foreground italic">No slides yet — fall back to logo + clock.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
        <div className="flex gap-2">
          <select
            value={draftType}
            onChange={(e) => setDraftType(e.target.value as PlaylistSlide["type"])}
            className="rounded-md border border-border/60 bg-background px-2 text-[12px]"
          >
            <option value="image">Image</option>
            <option value="video">Video / YouTube embed</option>
            <option value="iframe">iframe URL</option>
          </select>
          <input
            type="number"
            min={3}
            max={600}
            value={draftDuration}
            onChange={(e) => setDraftDuration(parseInt(e.target.value) || 15)}
            className="w-20 rounded-md border border-border/60 bg-background px-2 text-[12px]"
            placeholder="15s"
          />
        </div>
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://… or https://www.youtube.com/embed/…"
          className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-[12px]"
        />
        <Button size="sm" onClick={addSlide}>Add slide</Button>
      </div>
    </div>
  )
}

function SettingToggle({ icon: Icon, label, description, checked, onChange }: {
  icon: typeof Monitor;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

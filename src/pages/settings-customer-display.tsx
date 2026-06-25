/**
 * Customer display settings — fully redesigned.
 *
 * Editorial layout (frontend-design + emil-design-eng skills):
 *   - Newspaper-masthead PageHeader at the top (eyebrow + serif title +
 *     plain-language lede + right-aligned "Open display" CTA).
 *   - Three vertical sections separated by hairline rules: Privacy,
 *     What's shown, Idle playlist.
 *   - Generous gutters between sections. Mono captions for axis labels.
 *   - Playlist tiles are bigger, show thumbnails for image slides, source
 *     icon for iframe/local-video, and have drag-style reorder controls
 *     (up/down arrows) plus per-slide duration inline-editable.
 *
 * Local video files supported alongside the existing image/iframe types.
 * We use Tauri's dialog plugin to let the user pick from the file system
 * and `convertFileSrc()` to turn the absolute path into a URL the
 * second-window webview can load.
 */
import { useEffect, useState } from "react"
import {
  Eye,
  Monitor,
  Receipt,
  User,
  PlusCircle,
  Trash,
  ArrowUp,
  ArrowDown,
  ImageSquare,
  VideoCamera,
  Globe,
  Folder,
} from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { query, execute } from "@/lib/db"
import {
  openCustomerDisplay,
  closeCustomerDisplay,
  isCustomerDisplayOpen,
} from "@/lib/customer-display"
import { toast } from "sonner"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import { convertFileSrc } from "@tauri-apps/api/core"

const MODULES = [
  { id: "core" as const, label: "Core (POS only)", defaultPrivacy: false },
  { id: "dawa" as const, label: "Dawa — Pharmacy", defaultPrivacy: true },
  { id: "retail" as const, label: "Retail (Soko)", defaultPrivacy: false },
  { id: "hardware" as const, label: "Hardware", defaultPrivacy: false },
  { id: "hospitality" as const, label: "Hospitality", defaultPrivacy: false },
]

export function CustomerDisplaySettingsPage() {
  const [privacyByModule, setPrivacyByModule] = useState<Record<string, boolean>>({})
  const [showTax, setShowTax] = useState(true)
  const [showCustomer, setShowCustomer] = useState(true)
  const [displayOpen, setDisplayOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const keys = MODULES.map((m) => `customer_display.privacy.${m.id}`).concat([
      "customer_display.show_tax",
      "customer_display.show_customer",
    ])
    const placeholders = keys.map((_, i) => `?${i + 1}`).join(",")
    Promise.all([
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
        keys,
      ),
      isCustomerDisplayOpen(),
    ]).then(([rows, open]) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      const pm: Record<string, boolean> = {}
      for (const m of MODULES) {
        const v = map[`customer_display.privacy.${m.id}`]
        pm[m.id] = v === undefined ? m.defaultPrivacy : v === "1"
      }
      setPrivacyByModule(pm)
      setShowTax(map["customer_display.show_tax"] !== "0")
      setShowCustomer(map["customer_display.show_customer"] !== "0")
      setDisplayOpen(open)
      setLoading(false)
    })
  }, [])

  const save = async (key: string, value: string) => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'customer_display')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value],
    )
  }

  const toggleDisplay = async () => {
    try {
      if (displayOpen) {
        await closeCustomerDisplay()
        setDisplayOpen(false)
        toast.success("Customer display closed")
      } else {
        await openCustomerDisplay()
        setDisplayOpen(true)
        toast.success("Customer display opened")
      }
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-10 max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Customer display"
        description="The second-monitor screen your customers face while you ring up sales. Set what they see and what stays private."
        actions={
          <Button onClick={toggleDisplay} variant={displayOpen ? "outline" : "default"} size="sm">
            <Monitor className="h-3.5 w-3.5" />
            {displayOpen ? "Close display" : "Open display"}
          </Button>
        }
      />

      {/* ─── Privacy mode per module ──────────────────────────── */}
      <section className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Privacy
          </span>
          <h2
            style={{ fontFamily: "var(--font-display, serif)" }}
            className="text-[20px] font-medium tracking-[-0.01em]"
          >
            What customers see <em>per module</em>
          </h2>
          <p className="text-[13px] leading-[1.55] text-muted-foreground max-w-[60ch]">
            When ON, item names hide on the customer-facing screen — useful for pharmacies
            where medication names are confidential. Off elsewhere so the customer can
            confirm what they&rsquo;re paying for.
          </p>
        </header>
        <ul className="rounded-md border border-foreground/10 divide-y divide-foreground/5">
          {MODULES.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <Eye className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[14px]">{m.label}</span>
              </div>
              <Switch
                checked={privacyByModule[m.id] ?? m.defaultPrivacy}
                onCheckedChange={(v) => {
                  setPrivacyByModule((p) => ({ ...p, [m.id]: v }))
                  save(`customer_display.privacy.${m.id}`, v ? "1" : "0")
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ─── What's shown on screen ──────────────────────────── */}
      <section className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            On screen
          </span>
          <h2
            style={{ fontFamily: "var(--font-display, serif)" }}
            className="text-[20px] font-medium tracking-[-0.01em]"
          >
            Layout <em>details</em>
          </h2>
        </header>
        <ul className="rounded-md border border-foreground/10 divide-y divide-foreground/5">
          <SettingRow
            icon={Receipt}
            label="Tax breakdown"
            description="Show the tax line separately from the total."
            checked={showTax}
            onChange={(v) => {
              setShowTax(v)
              save("customer_display.show_tax", v ? "1" : "0")
            }}
          />
          <SettingRow
            icon={User}
            label="Customer name"
            description="Show the selected customer&rsquo;s name on the display."
            checked={showCustomer}
            onChange={(v) => {
              setShowCustomer(v)
              save("customer_display.show_customer", v ? "1" : "0")
            }}
          />
        </ul>
      </section>

      {/* ─── Idle playlist ──────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Idle playlist
          </span>
          <h2
            style={{ fontFamily: "var(--font-display, serif)" }}
            className="text-[20px] font-medium tracking-[-0.01em]"
          >
            What plays <em>when the till is empty</em>
          </h2>
          <p className="text-[13px] leading-[1.55] text-muted-foreground max-w-[60ch]">
            Rotate through promo images, local videos saved on this computer, or live
            YouTube/web embeds. Slides switch automatically. The cart takes over the
            instant a cashier rings up an item.
          </p>
        </header>
        <PlaylistEditor />
      </section>
    </div>
  )
}

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof Monitor
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="h-3.5 w-3.5 mt-1 text-muted-foreground/60 shrink-0" />
        <div className="min-w-0">
          <div className="text-[14px] font-medium">{label}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </li>
  )
}

interface PlaylistSlide {
  type: "image" | "video" | "iframe"
  url: string
  durationSeconds: number
}

function PlaylistEditor() {
  const [slides, setSlides] = useState<PlaylistSlide[]>([])
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

  const addSlide = (slide: PlaylistSlide) => {
    const next = [...slides, slide]
    setSlides(next)
    persist(next)
  }

  const removeSlide = (idx: number) => {
    const next = slides.filter((_, i) => i !== idx)
    setSlides(next)
    persist(next)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= slides.length) return
    const next = [...slides]
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    setSlides(next)
    persist(next)
  }

  const updateDuration = (idx: number, dur: number) => {
    const next = [...slides]
    next[idx] = { ...next[idx], durationSeconds: Math.max(3, Math.min(600, dur)) }
    setSlides(next)
    persist(next)
  }

  if (loading) return <div className="text-[12px] text-muted-foreground">Loading playlist…</div>

  return (
    <div className="flex flex-col gap-4">
      {slides.length === 0 ? (
        <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center">
          <Monitor className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground">
            No slides yet. Falls back to the business logo + clock when idle.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {slides.map((s, i) => (
            <SlideTile
              key={`${s.url}-${i}`}
              slide={s}
              index={i}
              total={slides.length}
              onRemove={() => removeSlide(i)}
              onMove={(dir) => move(i, dir)}
              onDuration={(d) => updateDuration(i, d)}
            />
          ))}
        </ul>
      )}
      <AddSlide onAdd={addSlide} />
    </div>
  )
}

function SlideTile({
  slide,
  index,
  total,
  onRemove,
  onMove,
  onDuration,
}: {
  slide: PlaylistSlide
  index: number
  total: number
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onDuration: (d: number) => void
}) {
  const TypeIcon = slide.type === "image" ? ImageSquare : slide.type === "video" ? VideoCamera : Globe

  return (
    <li className="flex items-center gap-4 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
      {/* Thumbnail / source preview */}
      <div className="size-16 shrink-0 rounded-md overflow-hidden border border-foreground/10 bg-foreground/[0.03] grid place-items-center">
        {slide.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.url}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : (
          <TypeIcon className="h-6 w-6 text-muted-foreground/60" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {slide.type === "image" ? "Image" : slide.type === "video" ? "Local video" : "Iframe"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            #{index + 1} of {total}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-foreground/85 truncate" title={slide.url}>
          {slide.url}
        </p>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          min={3}
          max={600}
          value={slide.durationSeconds}
          onChange={(e) => onDuration(parseInt(e.target.value) || 15)}
          className="w-16 h-8 font-mono text-[12px] text-right"
        />
        <span className="text-[11px] text-muted-foreground">s</span>
      </div>

      {/* Reorder + remove */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          title="Move up"
          className="h-7 w-7"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          title="Move down"
          className="h-7 w-7"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={onRemove} title="Remove" className="h-7 w-7">
          <Trash className="h-3.5 w-3.5 text-rose-600" />
        </Button>
      </div>
    </li>
  )
}

/**
 * Convert paste-able URLs into iframe-friendly equivalents.
 *
 * YouTube refuses to render its `/watch?v=…` URLs inside an iframe
 * (X-Frame-Options: SAMEORIGIN), so the iframe shows "youtube refused
 * to connect". We rewrite those URLs to the `/embed/…` form which
 * YouTube explicitly supports for embedding, optionally adding
 * autoplay + mute params so the slide actually starts playing.
 *
 * Vimeo has the same problem; convert `vimeo.com/ID` →
 * `player.vimeo.com/video/ID`.
 *
 * Anything we don't recognise passes through unchanged.
 */
function normalizeUrl(raw: string, type: PlaylistSlide["type"]): { normalized: string; note?: string } {
  // YouTube
  // - youtube.com/watch?v=XYZ
  // - youtu.be/XYZ
  // - m.youtube.com/watch?v=XYZ
  // - youtube.com/shorts/XYZ
  const ytPatterns: Array<{ re: RegExp; group: number }> = [
    { re: /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i, group: 1 },
    { re: /youtu\.be\/([\w-]{6,})/i, group: 1 },
    { re: /youtube\.com\/shorts\/([\w-]{6,})/i, group: 1 },
    { re: /youtube\.com\/embed\/([\w-]{6,})/i, group: 1 }, // already in embed form — keep
  ]
  for (const p of ytPatterns) {
    const m = raw.match(p.re)
    if (m && m[p.group]) {
      const videoId = m[p.group]
      const embed = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&loop=1&playlist=${videoId}`
      const noteText = type === "video" && !raw.includes("/embed/") ? "Converted to YouTube embed URL" : undefined
      return { normalized: embed, note: noteText }
    }
  }

  // Vimeo
  const vimeoMatch = raw.match(/(?:vimeo\.com|player\.vimeo\.com\/video)\/(\d+)/i)
  if (vimeoMatch) {
    const id = vimeoMatch[1]
    const embed = `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1`
    const note = raw.includes("player.vimeo.com") ? undefined : "Converted to Vimeo embed URL"
    return { normalized: embed, note }
  }

  return { normalized: raw }
}

function AddSlide({ onAdd }: { onAdd: (slide: PlaylistSlide) => void }) {
  const [type, setType] = useState<PlaylistSlide["type"]>("image")
  const [url, setUrl] = useState("")
  const [duration, setDuration] = useState(15)

  const pickLocalVideo = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Video files",
            extensions: ["mp4", "webm", "mov", "mkv", "avi", "m4v"],
          },
        ],
      })
      if (!picked || typeof picked !== "string") return
      // convertFileSrc turns "C:/Users/…/promo.mp4" → "asset://localhost/…"
      // which the second-window webview can load.
      const assetUrl = convertFileSrc(picked)
      onAdd({ type: "video", url: assetUrl, durationSeconds: Math.max(3, duration) })
      setUrl("")
      toast.success("Video added to playlist", { description: picked.split(/[\\/]/).pop() })
    } catch (e) {
      toast.error("Couldn't open video", { description: String(e) })
    }
  }

  const pickLocalImage = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Image files",
            extensions: ["jpg", "jpeg", "png", "webp", "gif"],
          },
        ],
      })
      if (!picked || typeof picked !== "string") return
      const assetUrl = convertFileSrc(picked)
      onAdd({ type: "image", url: assetUrl, durationSeconds: Math.max(3, duration) })
      setUrl("")
      toast.success("Image added to playlist", { description: picked.split(/[\\/]/).pop() })
    } catch (e) {
      toast.error("Couldn't open image", { description: String(e) })
    }
  }

  const addFromUrl = () => {
    if (!url.trim()) {
      toast.error("Paste a URL or pick a file first")
      return
    }
    const { normalized, note } = normalizeUrl(url.trim(), type)
    onAdd({ type, url: normalized, durationSeconds: Math.max(3, duration) })
    setUrl("")
    if (note) {
      toast.success("Slide added", { description: note })
    } else {
      toast.success("Slide added to playlist")
    }
  }

  return (
    <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Add a slide
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={3}
            max={600}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
            className="w-16 h-8 font-mono text-[12px] text-right"
          />
          <span className="text-[11px] text-muted-foreground">s each</span>
        </div>
      </div>

      {/* From file (local) */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={pickLocalImage}>
          <Folder className="h-3.5 w-3.5" />
          Pick local image
        </Button>
        <Button variant="outline" size="sm" onClick={pickLocalVideo}>
          <Folder className="h-3.5 w-3.5" />
          Pick local video
        </Button>
      </div>

      {/* Or paste a URL */}
      <div className="border-t border-foreground/5 pt-3 flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Or paste a URL
        </span>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(String(v) as PlaylistSlide["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="image">Image URL</SelectItem>
            <SelectItem value="video">Video URL (YouTube / Vimeo / direct .mp4)</SelectItem>
            <SelectItem value="iframe">Iframe / web embed</SelectItem>
          </SelectContent></Select>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              type === "video"
                ? "Paste any YouTube watch URL — we'll convert"
                : type === "image"
                  ? "https://example.com/promo.jpg"
                  : "https://example.com/menu"
            }
            className="flex-1 h-8 text-[12px]"
          />
          <Button size="sm" onClick={addFromUrl}>
            Add
          </Button>
        </div>
        <p className="text-[11px] leading-[1.55] text-muted-foreground">
          YouTube videos: paste any URL (<span className="font-mono">/watch</span>,{" "}
          <span className="font-mono">youtu.be/…</span>, or <span className="font-mono">/embed/…</span>) — we convert to the embed
          form so YouTube doesn&rsquo;t refuse the iframe. Direct{" "}
          <span className="font-mono">.mp4</span>/<span className="font-mono">.webm</span> URLs also work.
        </p>
      </div>
    </div>
  )
}

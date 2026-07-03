/**
 * Appearance settings — theme picker + light/dark toggle.
 *
 * Six palettes live as CSS blocks in src/index.css. Selecting one flips the
 * data-theme attribute on <html>, which cascades through every token
 * (--background, --foreground, --card, --border, --sidebar, --chart-*).
 *
 * Light/dark is a separate axis (.dark class on <html>). The two are
 * independent — user can be on Sepia + dark, or Nordic + light, etc.
 * A third option "system" follows the OS colour scheme.
 */
import { Check, Moon, Sun, Monitor } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { THEMES, useThemeStore, type PaletteId, type Mode } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function AppearanceSettingsPage() {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);
  const mode = useThemeStore((s) => s.theme);
  const setMode = useThemeStore((s) => s.setTheme);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Appearance"
        title="Themes"
        description="Pick a palette that's easy on your eyes. Every module inherits it. Change any time."
        back={{ fallback: "/settings" }}
      />

      {/* Light / dark / system toggle */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Brightness
        </p>
        <div className="inline-flex gap-1 rounded-md border border-border p-0.5">
          {([
            ["light",  "Light",  Sun],
            ["dark",   "Dark",   Moon],
            ["system", "System", Monitor],
          ] as Array<[Mode, string, typeof Sun]>).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Palette grid */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Palette
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              id={t.id}
              name={t.name}
              description={t.description}
              active={palette === t.id}
              onSelect={() => setPalette(t.id)}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-[70ch]">
        Palettes preserve semantic colours (red for danger, green for positive,
        amber for warning) unchanged. Only structural surfaces (background,
        card, muted, sidebar) shift. Charts inherit theme-appropriate axis,
        grid, and tooltip colours automatically.
      </p>
    </div>
  );
}

function ThemeCard({ id, name, description, active, onSelect }: {
  id: PaletteId;
  name: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative text-left rounded-lg border transition-all",
        active
          ? "border-primary ring-2 ring-primary/20 shadow-sm"
          : "border-border hover:border-muted-foreground/50",
      )}
    >
      <Card className="border-0 rounded-lg">
        <CardContent className="p-4">
          {/* Swatch — 6 chips mimicking the palette's key tokens */}
          <div
            data-theme={id}
            className="grid grid-cols-6 gap-1 mb-3 rounded overflow-hidden"
          >
            <div className="h-8 bg-background" />
            <div className="h-8 bg-card" />
            <div className="h-8 bg-muted" />
            <div className="h-8 bg-accent" />
            <div className="h-8 bg-primary" />
            <div className="h-8 bg-border" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px]">{name}</span>
            {active && (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                <Check className="h-3 w-3" /> Active
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 leading-[1.4]">
            {description}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

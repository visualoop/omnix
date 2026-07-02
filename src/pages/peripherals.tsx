import { useEffect, useState, useCallback } from "react";
import {
  Plug,
  Plus,
  Trash,
  CheckCircle,
  Warning,
  Printer,
  DesktopTower as MonitorPlay,
  Scales,
  CreditCard,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listPeripherals,
  savePeripheral,
  deletePeripheral,
  togglePeripheral,
  markTested,
  openCashDrawer,
  weighNext,
  type Peripheral,
  type PeripheralKind,
  type PeripheralDriver,
} from "@/services/peripherals";
import { intlLocale } from "@/lib/intl";

const KIND_LABEL: Record<PeripheralKind, string> = {
  cash_drawer: "Cash drawer",
  weight_scale: "Weight scale",
  kitchen_printer: "Kitchen printer",
  card_reader: "Card reader",
};

const KIND_ICON: Record<PeripheralKind, typeof Plug> = {
  cash_drawer: MonitorPlay,
  weight_scale: Scales,
  kitchen_printer: Printer,
  card_reader: CreditCard,
};

const DRIVERS: Record<PeripheralKind, PeripheralDriver[]> = {
  cash_drawer: ["printer_kick", "usb", "serial"],
  weight_scale: ["usb", "serial", "network"],
  kitchen_printer: ["network", "usb", "serial"],
  card_reader: ["usb", "serial", "network"],
};

export function PeripheralsPage() {
  const [items, setItems] = useState<Peripheral[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Peripheral | null>(null);
  const [creating, setCreating] = useState<PeripheralKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listPeripherals());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTest = async (p: Peripheral) => {
    let ok = false;
    if (p.kind === "cash_drawer") {
      ok = await openCashDrawer(p.id);
    } else if (p.kind === "weight_scale") {
      const kg = await weighNext(p.id);
      ok = kg !== null;
      if (ok) toast.success(`Scale reads ${kg} kg`);
    } else {
      toast.info(`Live test not yet implemented for ${KIND_LABEL[p.kind]}`);
      ok = false;
    }
    await markTested(p.id, ok);
    if (!ok) toast.error(`${p.name} did not respond`);
    load();
  };

  const handleToggle = async (p: Peripheral, enabled: boolean) => {
    await togglePeripheral(p.id, enabled);
    load();
  };

  const handleDelete = async (p: Peripheral) => {
    await deletePeripheral(p.id);
    load();
  };

  // Group items by kind for clearer visual hierarchy.
  const grouped: Record<PeripheralKind, Peripheral[]> = {
    cash_drawer: [], weight_scale: [], kitchen_printer: [], card_reader: [],
  };
  for (const p of items) {
    grouped[p.kind]?.push(p);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Hardware"
        title="Peripherals"
        description="Register cash drawers, weight scales, kitchen printers and card readers. Test each one after wiring."
        back={{ fallback: "/settings" }}
      />

      {/* Add-a-device row — its own section, not fighting with the title. */}
      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Add a device
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(KIND_LABEL) as PeripheralKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                onClick={() => setCreating(k)}
                className="flex items-center gap-2 rounded-md border border-border p-3 hover:border-primary/50 hover:bg-accent text-left text-[13px]"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1">{KIND_LABEL[k]}</span>
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Devices — grouped by kind. */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Plug className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No peripherals registered yet. Add one using the buttons above.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as PeripheralKind[]).map((kind) => {
            const list = grouped[kind];
            if (list.length === 0) return null;
            const Icon = KIND_ICON[kind];
            return (
              <section key={kind}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {KIND_LABEL[kind]} <span className="text-muted-foreground/60">({list.length})</span>
                </div>
                <div className="space-y-2">
                  {list.map((p) => (
                    <div key={p.id} className="rounded-md border border-border p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium truncate">{p.name}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">
                          Driver: <span className="font-mono">{p.driver}</span>
                          {p.connection_string && (
                            <> · <span className="font-mono">{p.connection_string}</span></>
                          )}
                        </div>
                        {p.last_test_at && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            {p.last_test_ok ? (
                              <><CheckCircle className="h-3 w-3 text-emerald-600" /> Last test OK</>
                            ) : (
                              <><Warning className="h-3 w-3 text-red-600" /> Last test failed</>
                            )}
                            <span>· {new Date(p.last_test_at + "Z").toLocaleString(intlLocale())}</span>
                          </div>
                        )}
                      </div>
                      <Switch checked={!!p.enabled} onCheckedChange={(e) => handleToggle(p, e)} />
                      <Button variant="outline" size="sm" onClick={() => handleTest(p)}>Test</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <PeripheralDialog
        open={creating !== null || editing !== null}
        onOpenChange={(v) => { if (!v) { setCreating(null); setEditing(null); } }}
        editing={editing}
        createKind={creating}
        onSaved={() => { setCreating(null); setEditing(null); load(); }}
      />
    </div>
  );
}

function PeripheralDialog({
  open, onOpenChange, editing, createKind, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Peripheral | null;
  createKind: PeripheralKind | null;
  onSaved: () => void;
}) {
  const initial = editing ?? {
    id: undefined as string | undefined,
    kind: createKind ?? "cash_drawer",
    name: "",
    driver: "printer_kick" as PeripheralDriver,
    connection_string: "",
    station_id: null as string | null,
  };

  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<PeripheralKind>(initial.kind);
  const [driver, setDriver] = useState<PeripheralDriver>(initial.driver);
  const [connStr, setConnStr] = useState(initial.connection_string ?? "");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind((editing?.kind ?? createKind ?? "cash_drawer") as PeripheralKind);
      setDriver(editing?.driver ?? DRIVERS[(editing?.kind ?? createKind ?? "cash_drawer") as PeripheralKind][0]);
      setConnStr(editing?.connection_string ?? "");
    }
  }, [open, editing, createKind]);

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    try {
      await savePeripheral({
        id: editing?.id,
        kind,
        name: name.trim(),
        driver,
        connection_string: connStr.trim() || undefined,
      });
      toast.success(editing ? "Saved" : "Added");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit peripheral" : `Add ${KIND_LABEL[kind]}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash drawer at till 1" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground">Type</label>
              <Select value={kind} onValueChange={(v) => { setKind(v as PeripheralKind); setDriver(DRIVERS[v as PeripheralKind][0]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground">Driver</label>
              <Select value={driver} onValueChange={(v) => setDriver(v as PeripheralDriver)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DRIVERS[kind].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">
              Connection string {driver === "network" ? "(host:port)" : driver === "serial" ? "(COM3)" : driver === "usb" ? "(vendor:product)" : "(printer id)"}
            </label>
            <Input value={connStr} onChange={(e) => setConnStr(e.target.value)} placeholder="…" className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChatCircleText } from "@phosphor-icons/react";
import {
  templatesForProducts,
  renderChecklist,
  recordEncounter,
  type CounsellingTemplate,
} from "@/services/counselling";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  productIds: string[];
  patientName: string;
  prescriptionId?: string | null;
  saleId?: string | null;
  customerId?: string | null;
  onRecorded?: () => void;
}

/**
 * Counselling checklist shown at dispense. Resolves templates for the
 * prescribed products, presents the talking points grouped per drug,
 * and records a counselling_encounter with the pharmacist signature +
 * patient acknowledgement.
 */
export function CounsellingSheet({
  open, onClose, productIds, patientName, prescriptionId, saleId, customerId, onRecorded,
}: Props) {
  const [templates, setTemplates] = useState<CounsellingTemplate[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const pharmacistId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!open || productIds.length === 0) { setTemplates([]); return; }
    templatesForProducts(productIds).then(setTemplates);
    setChecked({});
    setAcknowledged(false);
  }, [open, productIds.join(",")]);

  const allPoints = templates.flatMap((t) =>
    renderChecklist(t).map((p) => ({ ...p, templateId: t.id, key: `${t.id}:${p.field}` })),
  );
  const allChecked = allPoints.length > 0 && allPoints.every((p) => checked[p.key]);

  const save = async () => {
    if (!pharmacistId) { toast.error("Not signed in"); return; }
    setSaving(true);
    try {
      await recordEncounter({
        prescriptionId, saleId, customerId,
        patientName,
        pharmacistId,
        templateIds: templates.map((t) => t.id),
        checklist: checked,
        patientAcknowledged: acknowledged,
      });
      toast.success("Counselling recorded");
      onRecorded?.();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ChatCircleText className="h-5 w-5 text-teal-600" /> Counsel {patientName}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No counselling template matched these items. Add templates in the counselling settings, or counsel from clinical knowledge.
            </p>
          ) : (
            templates.map((t) => {
              const points = renderChecklist(t);
              return (
                <div key={t.id} className="border border-border rounded-lg p-3">
                  <h3 className="font-semibold text-sm mb-2">{t.name}</h3>
                  <ul className="space-y-2">
                    {points.map((p) => {
                      const key = `${t.id}:${p.field}`;
                      const isWarning = p.field === "warnings";
                      return (
                        <li key={key} className="flex items-start gap-2">
                          <Checkbox
                            checked={!!checked[key]}
                            onCheckedChange={(v) => setChecked({ ...checked, [key]: v === true })}
                            className="mt-0.5"
                          />
                          <div className={`text-xs ${isWarning ? "text-destructive" : ""}`}>
                            <span className="font-medium uppercase tracking-wide text-[10px] text-muted-foreground">{p.label}: </span>
                            <span>{p.text}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}

          {templates.length > 0 && (
            <>
              <label className="flex items-start gap-2 text-xs cursor-pointer border-t border-border pt-3">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span>Patient confirmed understanding of the above.</span>
              </label>
              <Button onClick={save} disabled={saving || !allChecked} className="w-full">
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {saving ? "Recording…" : allChecked ? "Record counselling" : "Tick all points to record"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

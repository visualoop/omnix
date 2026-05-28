/**
 * Pediatric weight-based dose calculator.
 *
 * Most pharmacotherapy in children doses by mg/kg or mg/m². This component
 * computes both: maintenance dose by weight and total daily dose with split.
 */
import { useState } from "react";
import { Calculator, AlertTriangle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const COMMON_DRUGS = [
  { name: "Paracetamol", min: 10, max: 15, unit: "mg/kg", interval_h: 6, max_per_day: 60, formulations: ["120mg/5ml syrup", "250mg/5ml syrup"] },
  { name: "Ibuprofen", min: 5, max: 10, unit: "mg/kg", interval_h: 8, max_per_day: 40, formulations: ["100mg/5ml syrup"] },
  { name: "Amoxicillin", min: 25, max: 50, unit: "mg/kg/day", interval_h: 8, formulations: ["125mg/5ml syrup", "250mg/5ml syrup"] },
  { name: "Co-amoxiclav", min: 25, max: 45, unit: "mg/kg/day", interval_h: 12, formulations: ["156mg/5ml syrup", "228mg/5ml syrup"] },
  { name: "Cefuroxime", min: 20, max: 30, unit: "mg/kg/day", interval_h: 12, formulations: ["125mg/5ml syrup", "250mg/5ml syrup"] },
  { name: "Azithromycin", min: 10, max: 12, unit: "mg/kg", interval_h: 24, formulations: ["200mg/5ml syrup"] },
  { name: "Cetirizine", min: 0.25, max: 0.5, unit: "mg/kg", interval_h: 24, formulations: ["5mg/5ml syrup"] },
  { name: "Salbutamol", min: 0.1, max: 0.15, unit: "mg/kg", interval_h: 6, formulations: ["2mg/5ml syrup", "Inhaler 100mcg/puff"] },
  { name: "Metronidazole", min: 7.5, max: 7.5, unit: "mg/kg", interval_h: 8, formulations: ["200mg/5ml suspension"] },
  { name: "ORS (oral rehydration)", min: 50, max: 100, unit: "ml/kg", interval_h: 4, formulations: ["Sachets in 200ml water"] },
];

export function DoseCalculatorDialog({ open, onClose, defaultWeight }: {
  open: boolean;
  onClose: () => void;
  defaultWeight?: number;
}) {
  const [weight, setWeight] = useState(defaultWeight ? String(defaultWeight) : "");
  const [age, setAge] = useState("");
  const [selected, setSelected] = useState<typeof COMMON_DRUGS[number] | null>(null);
  const [customMgKg, setCustomMgKg] = useState("");

  const w = parseFloat(weight);
  const valid = w > 0 && w <= 100;
  const drug = selected;

  const compute = () => {
    if (!valid) return null;
    if (drug) {
      const minDose = w * drug.min;
      const maxDose = w * drug.max;
      const isPerDay = drug.unit.includes("/day");
      const dosesPerDay = isPerDay ? 24 / drug.interval_h : 1;
      const minPerDose = isPerDay ? minDose / dosesPerDay : minDose;
      const maxPerDose = isPerDay ? maxDose / dosesPerDay : maxDose;
      return {
        min_per_dose: minPerDose,
        max_per_dose: maxPerDose,
        per_day: w * (drug.min + drug.max) / 2 * (isPerDay ? 1 : dosesPerDay),
        max_per_day: drug.max_per_day ? drug.max_per_day * w : null,
        interval_h: drug.interval_h,
        unit: drug.unit,
      };
    }
    if (customMgKg) {
      const v = parseFloat(customMgKg);
      if (!isNaN(v)) return {
        min_per_dose: v * w,
        max_per_dose: v * w,
        per_day: null,
        max_per_day: null,
        interval_h: null,
        unit: "mg/kg",
      };
    }
    return null;
  };

  const result = compute();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-violet-600" />
            Pediatric Dose Calculator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Weight (kg) *</label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g., 12.5" autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Age (optional)</label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g., 3 yrs" />
            </div>
          </div>

          {!valid && weight && (
            <div className="flex items-center gap-2 text-amber-700 text-xs bg-amber-50 rounded p-2">
              <AlertTriangle className="h-4 w-4" />
              {w > 100 ? "Weight unusually high — verify, then use adult dosing." : "Enter weight in kilograms."}
            </div>
          )}

          {valid && (
            <>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Common Drug (or use custom mg/kg below)</label>
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-auto">
                  {COMMON_DRUGS.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => { setSelected(d); setCustomMgKg(""); }}
                      className={`text-left text-xs p-2 rounded border transition ${
                        drug?.name === d.name
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-border hover:bg-stone-50"
                      }`}
                    >
                      <div className="font-medium">{d.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.min}{d.min !== d.max ? `–${d.max}` : ""} {d.unit}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Or custom mg/kg per dose</label>
                <Input
                  type="number"
                  value={customMgKg}
                  onChange={(e) => { setCustomMgKg(e.target.value); setSelected(null); }}
                  placeholder="e.g., 5"
                />
              </div>

              {result && (
                <Card className="border-violet-200 bg-violet-50">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-violet-700 font-semibold">Calculated Dose</div>
                    <div className="text-2xl font-mono font-bold text-violet-900">
                      {result.min_per_dose === result.max_per_dose
                        ? `${result.min_per_dose.toFixed(1)} mg`
                        : `${result.min_per_dose.toFixed(1)} – ${result.max_per_dose.toFixed(1)} mg`}
                      <span className="text-sm text-violet-700 font-normal ml-1">per dose</span>
                    </div>
                    {result.interval_h && (
                      <div className="text-xs text-violet-800">
                        Every {result.interval_h} hours · {(24 / result.interval_h).toFixed(0)} doses/day
                      </div>
                    )}
                    {result.per_day && (
                      <div className="text-xs text-violet-800">
                        Daily total: ≈ {result.per_day.toFixed(1)} mg
                      </div>
                    )}
                    {result.max_per_day && (
                      <div className="text-xs text-rose-700 font-medium pt-1 border-t border-violet-200">
                        ⚠ Max {result.max_per_day.toFixed(0)} mg/day — do not exceed
                      </div>
                    )}
                    {drug && drug.formulations && (
                      <div className="text-[11px] text-violet-700 pt-1 border-t border-violet-200">
                        <b>Common formulations:</b> {drug.formulations.join(" · ")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {drug && drug.formulations[0]?.includes("/5ml") && result && (
                <SyrupVolume drug={drug} result={result} />
              )}
            </>
          )}

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Always verify against the BNF for Children or local formulary. This calculator is a quick reference, not a prescribing decision tool.
              Renal/hepatic impairment may require dose adjustment.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyrupVolume({ drug, result }: { drug: any; result: any }) {
  // Extract first syrup strength
  const m = drug.formulations[0].match(/(\d+(?:\.\d+)?)mg\/(\d+)ml/);
  if (!m) return null;
  const strength = parseFloat(m[1]);
  const volume = parseFloat(m[2]);
  const minMl = (result.min_per_dose * volume) / strength;
  const maxMl = (result.max_per_dose * volume) / strength;
  return (
    <Card>
      <CardContent className="p-3 text-xs space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">If using {drug.formulations[0]}</div>
        <div className="font-mono font-semibold">
          {minMl === maxMl ? `${minMl.toFixed(1)} ml` : `${minMl.toFixed(1)} – ${maxMl.toFixed(1)} ml`}
          <span className="text-xs text-muted-foreground font-normal ml-1">per dose</span>
        </div>
      </CardContent>
    </Card>
  );
}

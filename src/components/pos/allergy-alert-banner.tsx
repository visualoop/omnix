import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { checkDrugAllergies, type AllergyAlert } from "@/services/clinical";
import { Button } from "@/components/ui/button";

interface Props {
  customerId: string | null;
  productIds: string[];
}

/**
 * Pharmacy safety banner. Shows when the customer in cart has known allergies
 * that conflict with any of the products being dispensed.
 */
export function AllergyAlertBanner({ customerId, productIds }: Props) {
  const [alerts, setAlerts] = useState<AllergyAlert[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!customerId || productIds.length === 0) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    checkDrugAllergies(customerId, productIds).then((result) => {
      if (!cancelled) {
        setAlerts(result);
        setDismissed(false);
      }
    }).catch((e) => { console.error("Allergy check failed:", e); });
    return () => { cancelled = true; };
  }, [customerId, productIds.join(",")]);

  if (alerts.length === 0 || dismissed) return null;

  const hasSevere = alerts.some((a) => a.severity === "severe" || a.severity === "life_threatening" || a.severity === "life-threatening");

  return (
    <div className={`rounded-md border-2 p-3 flex items-start gap-2.5 ${
      hasSevere ? "border-red-500 bg-red-50" : "border-amber-500 bg-amber-50"
    }`}>
      <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${hasSevere ? "text-red-600" : "text-amber-600"}`} />
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${hasSevere ? "text-red-700" : "text-amber-700"}`}>
          {hasSevere ? "⚠ Severe allergy alert" : "Allergy alert"}
        </div>
        <ul className="mt-1 space-y-1 text-xs">
          {alerts.map((a, i) => (
            <li key={i}>
              <b>{a.product_name}</b> — patient is allergic to <b>{a.patient_allergen}</b>
              {" "}({a.matched_allergy_class} class, {a.severity}).
            </li>
          ))}
        </ul>
        <p className={`mt-1.5 text-[11px] ${hasSevere ? "text-red-600" : "text-amber-600"}`}>
          {hasSevere
            ? "Do NOT dispense without confirming with the prescribing doctor."
            : "Confirm with patient before dispensing."}
        </p>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={() => setDismissed(true)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

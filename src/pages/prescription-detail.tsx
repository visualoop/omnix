import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowClockwise as RotateCcw,
  ChatCircleText,
  CheckCircle,
  Coins,
  FileText,
  Pill,
  Prescription as PrescriptionIcon,
  Receipt,
  Stethoscope,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BackButton } from "@/components/ui/back-button";
import {
  getPrescription,
  preparePrescriptionForPosCheckout,
  type Prescription,
  type PrescriptionItem,
} from "@/services/pharmacy";
import { getClaim, type InsuranceClaim } from "@/services/insurance";
import { CounsellingSheet } from "@/components/pharmacy/counselling-sheet";
import { query } from "@/lib/db";
import { useCartStore } from "@/stores/cart";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

interface RefillChild {
  id: string;
  rx_number: number;
  status: string;
  created_at: string;
  sale_id: string | null;
}

export function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [refills, setRefills] = useState<RefillChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);
  const [counselOpen, setCounselOpen] = useState(false);
  const loadSnapshot = useCartStore((s) => s.loadSnapshot);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      const data = await getPrescription(id);
      if (!data) {
        setPrescription(null);
        setLoading(false);
        return;
      }
      setPrescription(data.prescription);
      setItems(data.items);

      // Linked insurance claim (if any)
      const claimRows = await query<{ id: string }>(
        `SELECT id FROM insurance_claims WHERE prescription_id = ?1 LIMIT 1`,
        [id],
      );
      if (claimRows[0]) {
        const c = await getClaim(claimRows[0].id);
        setClaim(c);
      } else {
        setClaim(null);
      }

      // Refill chain (children whose parent_prescription_id = this rx)
      const children = await query<RefillChild>(
        `SELECT id, rx_number, status, created_at, sale_id
           FROM prescriptions
          WHERE parent_prescription_id = ?1
          ORDER BY created_at ASC`,
        [id],
      );
      setRefills(children);

      setLoading(false);
    })();
  }, [id]);

  const handleDispense = async () => {
    if (!prescription) return;
    setDispensing(true);
    try {
      const checkout = await preparePrescriptionForPosCheckout(prescription.id);
      if (!checkout) {
        toast.error("Already dispensed or empty.");
        return;
      }
      loadSnapshot(checkout.items, 0, checkout.customerId ?? null, {
        source: {
          type: "prescription",
          id: prescription.id,
          label: `Rx #${prescription.rx_number} — ${prescription.patient_name}`,
        },
      });
      navigate("/pos/sale");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDispensing(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!prescription) {
    return (
      <div className="p-8">
        <BackButton fallback="/pharmacy" />
        <EmptyState
          icon={PrescriptionIcon}
          title="Prescription not found"
          description="This prescription may have been removed."
        />
      </div>
    );
  }

  const totalPrescribed = items.reduce((s, i) => s + i.quantity_prescribed, 0);
  const totalDispensed = items.reduce((s, i) => s + i.quantity_dispensed, 0);
  const refillsRemaining = Math.max(0, prescription.refills_authorized - prescription.refills_used);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <PrescriptionIcon className="h-5 w-5 text-teal-600" />
            Rx #{prescription.rx_number}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {prescription.patient_name}
            {prescription.patient_phone && <> · <span className="font-mono">{prescription.patient_phone}</span></>}
            {prescription.patient_age !== null && <> · Age {prescription.patient_age}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={prescription.status} />
          <Button size="sm" variant="outline" onClick={() => setCounselOpen(true)}>
            <ChatCircleText className="h-3.5 w-3.5 mr-1.5" /> Counsel
          </Button>
          {prescription.status === "pending" && (
            <Button size="sm" onClick={handleDispense} disabled={dispensing}>
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              {dispensing ? "Loading…" : "Dispense"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetaCard label="Prescriber" icon={Stethoscope}>
          {prescription.doctor_name ? (
            <>
              <div className="font-medium">{prescription.doctor_name}</div>
              {prescription.doctor_license && (
                <div className="text-[10px] font-mono text-muted-foreground">{prescription.doctor_license}</div>
              )}
              {prescription.hospital && (
                <div className="text-[10px] text-muted-foreground">{prescription.hospital}</div>
              )}
            </>
          ) : <span className="text-muted-foreground italic">—</span>}
        </MetaCard>
        <MetaCard label="Diagnosis" icon={FileText}>
          {prescription.diagnosis || <span className="text-muted-foreground italic">—</span>}
        </MetaCard>
        <MetaCard label="Refills" icon={RotateCcw}>
          <div className="font-mono text-lg">{prescription.refills_used}/{prescription.refills_authorized}</div>
          {refillsRemaining > 0 && (
            <div className="text-[10px] text-emerald-600">{refillsRemaining} remaining</div>
          )}
        </MetaCard>
        <MetaCard label="Items" icon={Pill}>
          <div className="font-mono">{items.length}</div>
          <div className="text-[10px] text-muted-foreground">
            {totalDispensed}/{totalPrescribed} units dispensed
          </div>
        </MetaCard>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Prescribed items</h2>
            <span className="text-xs text-muted-foreground">Created {new Date(prescription.created_at).toLocaleString(intlLocale())}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Drug</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Dose</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Frequency</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Prescribed</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Dispensed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs font-medium">
                    {it.product_name}
                    {it.instructions && (
                      <div className="text-[10px] text-muted-foreground italic mt-0.5">{it.instructions}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{it.dosage || "—"}</td>
                  <td className="px-3 py-2 text-xs">{it.frequency || "—"}</td>
                  <td className="px-3 py-2 text-xs">{it.duration || "—"}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{it.quantity_prescribed}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                    {it.quantity_dispensed === it.quantity_prescribed && it.quantity_dispensed > 0 ? (
                      <span className="text-emerald-600 flex items-center justify-end gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {it.quantity_dispensed}
                      </span>
                    ) : (
                      it.quantity_dispensed
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {prescription.notes && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-2">Notes</h2>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{prescription.notes}</p>
          </CardContent>
        </Card>
      )}

      {refills.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Refill history
            </h2>
            <ul className="space-y-1.5">
              {refills.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs">
                  <Link to={`/pharmacy/prescriptions/${r.id}`} className="hover:underline">
                    Rx #{r.rx_number}
                  </Link>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <StatusBadge status={r.status} />
                    <span>{new Date(r.created_at).toLocaleDateString(intlLocale())}</span>
                    {r.sale_id && (
                      <Link to={`/sales/history/${r.sale_id}`} className="hover:underline text-primary">
                        View sale
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {prescription.sale_id && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Linked sale</p>
              <p className="text-xs text-muted-foreground">
                This prescription was dispensed via a POS sale.
              </p>
            </div>
            <Link to={`/sales/history/${prescription.sale_id}`}>
              <Button variant="outline" size="sm">
                <Receipt className="h-3.5 w-3.5 mr-1.5" /> View sale
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {claim && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Insurance claim
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Provider</p>
                <p className="font-medium">{claim.provider_name || claim.provider_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Member</p>
                <p className="font-mono">{claim.member_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Claim amount</p>
                <p className="font-mono">{KES(claim.claim_amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={claim.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {items.some((it) => it.quantity_dispensed < it.quantity_prescribed) && prescription.status === "dispensed" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-3 flex items-start gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">Partial dispensing</p>
              <p className="text-muted-foreground">Some items dispensed less than prescribed. Balance may still be owed to the patient.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <CounsellingSheet
        open={counselOpen}
        onClose={() => setCounselOpen(false)}
        productIds={items.map((it) => it.product_id)}
        patientName={prescription.patient_name}
        prescriptionId={prescription.id}
        saleId={prescription.sale_id}
        customerId={prescription.customer_id}
      />
    </div>
  );
}

function MetaCard({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className="text-xs">{children}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "dispensed" || s === "paid") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Dispensed</Badge>;
  }
  if (s === "pending" || s === "draft") {
    return <Badge variant="outline" className="text-amber-700 text-[10px]">{status}</Badge>;
  }
  if (s === "cancelled" || s === "rejected") {
    return <Badge variant="destructive" className="text-[10px]">{status}</Badge>;
  }
  if (s === "submitted") {
    return <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px]">{status}</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
}

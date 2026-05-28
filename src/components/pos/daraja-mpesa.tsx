import { useState, useEffect, useRef } from "react";
import { Smartphone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initiateStkPush, queryStkStatus, getDarajaConfig } from "@/services/daraja";

interface Props {
  amount: number;
  saleId?: string;
  onSuccess: (ref: string) => void;
  onCancel: () => void;
}

type Status = "idle" | "initiating" | "polling" | "success" | "failed";

export function DarajaMpesaCharge({ amount, saleId, onSuccess, onCancel }: Props) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [configured, setConfigured] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    getDarajaConfig().then((c) => setConfigured(!!c?.active));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCharge = async () => {
    if (!phone.match(/^(254|0|7|1)\d{8,9}$/)) {
      setError("Enter a valid Kenyan phone (e.g. 0712345678)");
      return;
    }
    setError("");
    setStatus("initiating");
    try {
      const res = await initiateStkPush({
        amount,
        phone,
        accountRef: saleId || "POS",
        transactionDesc: "Sale payment",
      });
      setCheckoutRequestId(res.checkoutRequestId);
      setStatus("polling");
      startPolling(res.checkoutRequestId);
    } catch (e) {
      setError(String(e));
      setStatus("failed");
    }
  };

  const startPolling = (checkoutId: string) => {
    let attempts = 0;
    const maxAttempts = 40; // 40 × 5s = ~3 minutes
    pollRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const result = await queryStkStatus(checkoutId);
        if (result.status === "success") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("success");
          setTimeout(() => onSuccess(checkoutId), 800);
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError(result.message || "Transaction failed or was cancelled");
        } else if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError("Timed out waiting for M-Pesa confirmation. Check phone or verify manually.");
        }
      } catch {
        // Network issue — keep polling silently
      }
    }, 5000);
  };

  if (!configured) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">M-Pesa Daraja is not configured.</p>
        <p className="text-xs text-muted-foreground">
          Go to Settings → Payments to connect your M-Pesa till/paybill.
        </p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Use manual M-Pesa instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">Amount to charge via M-Pesa</p>
        <p className="text-2xl font-bold font-mono">KES {amount.toFixed(2)}</p>
      </div>

      {status === "idle" && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Customer's M-Pesa phone</label>
            <Input
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleCharge}>
              <Smartphone className="h-4 w-4 mr-1" /> Send STK Push (M-Pesa)
            </Button>
          </div>
        </>
      )}

      {(status === "initiating" || status === "polling") && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 mx-auto text-green-600 animate-spin" />
          <div>
            <p className="text-sm font-medium">
              {status === "initiating" ? "Sending STK push..." : "Waiting for customer PIN..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The customer should see an M-Pesa prompt on {phone}. Ask them to enter their PIN.
            </p>
          </div>
          {checkoutRequestId && (
            <p className="text-[10px] font-mono text-muted-foreground">
              Ref: {checkoutRequestId.slice(0, 12)}...
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            onCancel();
          }}>
            Cancel
          </Button>
        </div>
      )}

      {status === "success" && (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
          <p className="text-sm font-semibold">M-Pesa payment received</p>
          <p className="text-xs text-muted-foreground">Completing sale...</p>
        </div>
      )}

      {status === "failed" && (
        <div className="space-y-3">
          <div className="text-center py-2">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm font-semibold mt-2">Payment failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1" onClick={() => { setStatus("idle"); setError(""); }}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  DeviceMobile as Smartphone,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initiateMpesaCharge, verifyTransaction, submitChargeOtp, getPaystackConfig } from "@/services/paystack";

interface Props {
  amount: number;
  email: string;
  saleId?: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
}

type Status = "idle" | "initiating" | "awaiting_otp" | "polling" | "success" | "failed";

export function PaystackMpesaCharge({ amount, email, saleId, onSuccess, onCancel }: Props) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [configured, setConfigured] = useState(false);
  const [otp, setOtp] = useState("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    getPaystackConfig().then((c) => setConfigured(!!c?.active));
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
      const res = await initiateMpesaCharge({ amount, phone, email, saleId });
      setReference(res.reference);

      if (res.display_text?.toLowerCase().includes("otp")) {
        setStatus("awaiting_otp");
      } else {
        setStatus("polling");
        startPolling(res.reference);
      }
    } catch (e) {
      setError(String(e));
      setStatus("failed");
    }
  };

  const handleSubmitOtp = async () => {
    if (!reference || !otp) return;
    setError("");
    try {
      const res = await submitChargeOtp(reference, otp);
      if (res.status === "success") {
        setStatus("success");
        setTimeout(() => onSuccess(reference), 800);
      } else if (res.status === "pending") {
        setStatus("polling");
        startPolling(reference);
      } else {
        setStatus("failed");
        setError(res.message || "OTP rejected");
      }
    } catch (e) {
      setError(String(e));
      setStatus("failed");
    }
  };

  const startPolling = (ref: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 × 3s = 3 minutes
    pollRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const result = await verifyTransaction(ref);
        if (result.status === "success") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("success");
          setTimeout(() => onSuccess(ref), 800);
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError(result.message || "Transaction failed or was cancelled");
        } else if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError("Timed out waiting for confirmation. Please verify manually.");
        }
      } catch (e) {
        // Network issue — keep polling silently
      }
    }, 3000);
  };

  if (!configured) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Paystack is not configured.
        </p>
        <p className="text-xs text-muted-foreground">
          Go to Settings → Payments to connect your Paystack account.
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
        <p className="text-xs text-muted-foreground">Amount to charge</p>
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
            <Button className="flex-1" onClick={handleCharge}>
              <Smartphone className="h-4 w-4 mr-1" /> Send STK Push
            </Button>
          </div>
        </>
      )}

      {status === "awaiting_otp" && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium">Enter OTP</p>
            <p className="text-xs text-muted-foreground mt-1">Paystack requires OTP confirmation. Check {phone} for the code.</p>
          </div>
          <Input
            placeholder="Enter OTP code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmitOtp}>Submit OTP</Button>
          </div>
        </div>
      )}

      {(status === "initiating" || status === "polling") && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
          <div>
            <p className="text-sm font-medium">
              {status === "initiating" ? "Sending request to Paystack..." : "Waiting for customer PIN..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The customer should see a prompt on {phone}. Ask them to enter their M-Pesa PIN.
            </p>
          </div>
          {reference && (
            <p className="text-[10px] font-mono text-muted-foreground">
              Ref: {reference}
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
          <p className="text-sm font-semibold">Payment received</p>
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

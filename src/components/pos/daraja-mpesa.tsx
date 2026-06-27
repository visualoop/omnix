import { useState, useEffect, useRef } from "react";
import {
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  DeviceMobile as Smartphone,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initiateStkPush, queryStkStatus, getDarajaConfig, isDarajaSandbox, sandboxAutoConfirm } from "@/services/daraja";
import { MpesaIcon } from "@/components/icons/payment-brands";

interface Props {
  amount: number;
  saleId?: string;
  onSuccess: (ref: string) => void;
  onCancel: () => void;
}

type Status = "idle" | "initiating" | "polling" | "success" | "failed" | "manual";

export function DarajaMpesaCharge({ amount, saleId, onSuccess, onCancel }: Props) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [configured, setConfigured] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const autoConfirmedRef = useRef(false);

  useEffect(() => {
    getDarajaConfig().then((c) => setConfigured(!!c?.active));
    isDarajaSandbox().then(setSandbox);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // 1 Hz ticker so the polling UI shows elapsed seconds. Only runs
  // while we're actively polling; cheaper than re-deriving on every
  // render.
  useEffect(() => {
    if (status !== "polling" || !pollStartedAt) return;
    tickRef.current = window.setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [status, pollStartedAt]);

  const elapsedSec = pollStartedAt ? Math.floor((Date.now() - pollStartedAt) / 1000) : 0;
  // (elapsedTick is read implicitly via re-render dependency)
  void elapsedTick;

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
    setPollStartedAt(Date.now());
    const startedAt = Date.now();
    // Sandbox grace: Safaricom's sandbox often returns a spurious "failed"
    // code (1032 cancelled, 1037 timeout) on the very first poll even
    // though no STK ever reached a phone. We MUST give the auto-confirm
    // window a chance to fire instead of bailing on the first poll. The
    // grace is identical to the auto-confirm trigger (15s).
    const GRACE_MS = 15000;
    pollRef.current = window.setInterval(async () => {
      attempts++;
      const elapsed = Date.now() - startedAt;
      // Sandbox testing aid: the Daraja sandbox usually never delivers a
      // callback, so after a short grace period we auto-confirm so the POS
      // flow can be tested end to end. HARD-GATED to sandbox in the service
      // layer — this can never fire against a live payment.
      if (sandbox && !autoConfirmedRef.current && elapsed >= GRACE_MS) {
        autoConfirmedRef.current = true;
        await runSandboxAutoConfirm(checkoutId);
        return;
      }
      try {
        const result = await queryStkStatus(checkoutId);
        if (result.status === "success") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("success");
          setTimeout(() => onSuccess(checkoutId), 800);
        } else if (result.status === "failed") {
          // In sandbox, suppress 'failed' verdicts during the grace window —
          // Safaricom's sandbox routinely returns 1032/1037 on the first
          // poll even when no STK was ever delivered. Auto-confirm will
          // resolve the transaction at the GRACE_MS boundary. In live mode
          // (sandbox=false), 'failed' is always terminal.
          if (sandbox && elapsed < GRACE_MS) {
            // keep polling silently — auto-confirm will handle it
          } else {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("failed");
            setError(result.message || "Transaction failed or was cancelled");
          }
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

  /**
   * Sandbox-only: force the pending transaction to confirmed so testing can
   * proceed when Safaricom's sandbox never returns a callback. The service
   * refuses unless test_mode is on, so there's no way to misfire in prod.
   */
  const runSandboxAutoConfirm = async (checkoutId: string) => {
    try {
      const res = await sandboxAutoConfirm(checkoutId);
      if (res.ok) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("success");
        setTimeout(() => onSuccess(checkoutId), 600);
      } else {
        setError(res.reason || "Sandbox auto-confirm failed");
      }
    } catch (e) {
      setError("Sandbox auto-confirm failed: " + String(e));
    }
  };

  /**
   * Manual one-off status check — useful when polling is slow or the
   * customer says they've already confirmed but the auto-poll hasn't
   * caught up. Hits queryStkStatus immediately instead of waiting for
   * the next 5-second tick.
   */
  const checkNow = async () => {
    if (!checkoutRequestId || checking) return;
    setChecking(true);
    try {
      const result = await queryStkStatus(checkoutRequestId);
      if (result.status === "success") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("success");
        setTimeout(() => onSuccess(checkoutRequestId), 600);
      } else if (result.status === "failed") {
        // In sandbox, don't surface a queryStkStatus 'failed' as terminal —
        // the cashier still has the 'Auto-confirm (sandbox)' button and the
        // poller can keep going. Switching to the failed view would hide
        // both options. In production, 'failed' is always terminal.
        if (sandbox) {
          // surface a gentle hint without tearing down the UI
          setError("Sandbox returned a failed code — use Auto-confirm to proceed.");
        } else {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError(result.message || "Transaction failed or was cancelled");
        }
      }
      // pending → leave the polling loop running
    } catch (e) {
      setError("Status check failed: " + String(e));
    } finally {
      setChecking(false);
    }
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
            {status === "polling" && elapsedSec > 0 ? (
              <p className="text-[11px] font-mono text-muted-foreground mt-1 tabular-nums">
                {Math.floor(elapsedSec / 60)}m {String(elapsedSec % 60).padStart(2, "0")}s elapsed
              </p>
            ) : null}
            {sandbox && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                Sandbox mode — payment auto-confirms after 15s for testing.
              </p>
            )}
          </div>
          {checkoutRequestId && (
            <p className="text-[10px] font-mono text-muted-foreground">
              Ref: {checkoutRequestId.slice(0, 12)}...
            </p>
          )}
          {/* Cashier controls — auto-poll runs every 5 seconds in the
              background, but sometimes the customer has already paid and
              the polling response lags. Check now hits the status API
              immediately. Resend re-fires the STK push (occasionally the
              customer dismisses the prompt by accident). */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={checkNow} disabled={checking}>
              {checking ? "Checking…" : "Check now"}
            </Button>
            {sandbox && checkoutRequestId && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => runSandboxAutoConfirm(checkoutRequestId)}
              >
                Auto-confirm (sandbox)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setStatus("idle");
                setError("");
                setCheckoutRequestId(null);
                setPollStartedAt(null);
                autoConfirmedRef.current = false;
              }}
            >
              Resend STK
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                onCancel();
              }}
            >
              Cancel
            </Button>
          </div>
          {/* After ~90s of dead air (common in the Daraja sandbox, and
              occasionally in production when the callback is slow), let
              the cashier confirm manually from the customer's M-Pesa SMS
              rather than blocking the till. */}
          {elapsedSec >= 90 && (
            <button
              type="button"
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setStatus("manual");
              }}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Taking too long? Mark as paid manually
            </button>
          )}
        </div>
      )}

      {status === "manual" && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium">Confirm M-Pesa payment manually</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask the customer for the M-Pesa confirmation SMS and enter the transaction code.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">M-Pesa transaction code</label>
            <Input
              placeholder="e.g. SLK7A9B2C1"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="font-mono"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setStatus("idle"); setManualCode(""); setError(""); }}>
              Back
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                const code = manualCode.trim();
                if (code.length < 6) { setError("Enter the full M-Pesa code"); return; }
                setStatus("success");
                setTimeout(() => onSuccess(code), 600);
              }}
            >
              Confirm payment
            </Button>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="text-center py-8 space-y-3">
          <div className="relative mx-auto w-fit">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-[#4FC52E]/30" />
            <MpesaIcon size={56} className="relative" />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-5 w-5 text-[#2E7D1B]" weight="fill" />
            <p className="text-sm font-semibold text-[#2E7D1B]">M-Pesa payment received</p>
          </div>
          <p className="text-xs text-muted-foreground">Completing sale…</p>
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
          <button
            type="button"
            onClick={() => { setStatus("manual"); setError(""); }}
            className="w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Customer already paid? Mark as paid manually
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  CheckCircle as CheckCircle2,
  Eye,
  EyeSlash as EyeOff,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getPaystackConfig, savePaystackConfig, verifyPaystackKey, disablePaystack } from "@/services/paystack";
import { getDarajaConfig, saveDarajaConfig, verifyDarajaKey, disableDaraja, getManualMpesaConfig, saveManualMpesaConfig } from "@/services/daraja";
import { getPaymentFees, savePaymentFees, type PaymentFees } from "@/services/payment-fees";
import { MpesaIcon, PaystackIcon } from "@/components/icons/payment-brands";
import { Switch } from "@/components/ui/switch";
import { listAllPaymentMethods, setPaymentMethodActive, type PaymentMethodRow } from "@/services/sales";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function PaymentSettingsPage() {
  // Paystack
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [paystackConnected, setPaystackConnected] = useState(false);
  const [paystackConnectedAt, setPaystackConnectedAt] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Daraja
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showDarajaSecret, setShowDarajaSecret] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [shortcode, setShortcode] = useState("");
  const [darajaTestMode, setDarajaTestMode] = useState(true);
  const [darajaConnected, setDarajaConnected] = useState(false);
  const [darajaConnectedAt, setDarajaConnectedAt] = useState<string | null>(null);
  const [verifyingDaraja, setVerifyingDaraja] = useState(false);

  // Per-provider merchant fees. Defaults reflect each provider's
  // published rate, but every merchant negotiates their own tariff so
  // the operator can override. Used by reports to compute net revenue.
  const [fees, setFees] = useState<PaymentFees>({
    paystack_mpesa_percent: 1.5,
    paystack_card_percent: 2.9,
    daraja_percent: 0,
  });
  const [savingFees, setSavingFees] = useState(false);

  // Manual M-Pesa (Paybill / Till) — the flow for businesses without
  // Daraja API keys. Customer pays the till directly; cashier records
  // the confirmation code.
  const [paybillNumber, setPaybillNumber] = useState("");
  const [paybillAccountHint, setPaybillAccountHint] = useState("");
  const [tillNumber, setTillNumber] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);

  const toggleMethod = async (m: PaymentMethodRow, next: boolean) => {
    if (!next && methods.filter((x) => x.active === 1).length <= 1) {
      toast.error("At least one payment method must stay enabled."); return;
    }
    try {
      await setPaymentMethodActive(m.id, next);
      setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, active: next ? 1 : 0 } : x));
    } catch (e) { toast.error(String(e)); }
  };

  const load = async () => {
    setMethods(await listAllPaymentMethods());
    const config = await getPaystackConfig();
    if (config) {
      setPublicKey(config.public_key || "");
      setSecretKey(config.secret_key || "");
      setTestMode(config.test_mode === 1);
      setPaystackConnected(config.active === 1);
      setPaystackConnectedAt(config.connected_at);
    }

    const dConfig = await getDarajaConfig();
    if (dConfig) {
      setConsumerKey(dConfig.public_key || "");
      setConsumerSecret(dConfig.secret_key || "");
      setPasskey(dConfig.passkey || "");
      setShortcode(dConfig.shortcode || "");
      setDarajaTestMode(dConfig.test_mode === 1);
      setDarajaConnected(dConfig.active === 1);
      setDarajaConnectedAt(dConfig.connected_at);
    }
    // Merchant fee overrides — falls back to the published defaults if
    // the settings rows don't exist yet.
    try {
      const f = await getPaymentFees();
      setFees(f);
    } catch {
      /* keep defaults */
    }

    // Manual M-Pesa Paybill/Till.
    try {
      const m = await getManualMpesaConfig();
      if (m) {
        setPaybillNumber(m.paybill_number || "");
        setPaybillAccountHint(m.paybill_account_hint || "");
        setTillNumber(m.till_number || "");
      }
    } catch {
      /* table may not exist on older DBs until migration 048 runs */
    }
  };

  const saveManual = async () => {
    setSavingManual(true);
    try {
      await saveManualMpesaConfig({ paybillNumber, paybillAccountHint, tillNumber });
      toast.success("Manual M-Pesa saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingManual(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSavePaystack = async () => {
    if (!publicKey.trim() || !secretKey.trim()) {
      toast.error("Both keys are required");
      return;
    }
    setVerifying(true);
    const verify = await verifyPaystackKey(secretKey);
    if (!verify.ok) {
      toast.error("Invalid secret key: " + (verify.error || "verification failed"));
      setVerifying(false);
      return;
    }
    await savePaystackConfig(publicKey, secretKey, testMode);
    toast.success("Paystack connected");
    setVerifying(false);
    load();
  };

  const handleDisconnectPaystack = async () => {
    await disablePaystack();
    setPaystackConnected(false);
    toast.success("Paystack disconnected");
  };

  const handleSaveDaraja = async () => {
    if (!consumerKey.trim() || !consumerSecret.trim() || !shortcode.trim()) {
      toast.error("Consumer key, consumer secret, and shortcode are required");
      return;
    }
    if (!passkey.trim()) {
      toast.error("Passkey is required for STK Push");
      return;
    }
    setVerifyingDaraja(true);
    const verify = await verifyDarajaKey(consumerKey, consumerSecret, darajaTestMode);
    if (!verify.ok) {
      toast.error("Invalid credentials: " + (verify.error || "verification failed"));
      setVerifyingDaraja(false);
      return;
    }
    await saveDarajaConfig({
      consumerKey: consumerKey.trim(),
      consumerSecret: consumerSecret.trim(),
      passkey: passkey.trim(),
      shortcode: shortcode.trim(),
      testMode: darajaTestMode,
    });
    toast.success("M-Pesa Daraja connected");
    setVerifyingDaraja(false);
    load();
  };

  const handleDisconnectDaraja = async () => {
    await disableDaraja();
    setDarajaConnected(false);
    toast.success("M-Pesa Daraja disconnected");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <BackButton fallback="/settings" />
        <h1 className="text-xl font-semibold tracking-tight">Payment Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure payment providers for automated processing.</p>
      </div>

      {/* Enabled payment methods — controls what the POS offers */}
      <div className="border border-border rounded-lg p-5 space-y-3">
        <div>
          <h2 className="font-semibold">Payment methods at the till</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Turn methods on or off — only enabled ones appear in the POS payment screen.</p>
        </div>
        <div className="divide-y divide-border">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-[13px] font-medium">{m.name}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{m.type.replace(/_/g, " ")}</div>
              </div>
              <Switch checked={m.active === 1} onCheckedChange={(c: boolean) => toggleMethod(m, c)} />
            </div>
          ))}
          {methods.length === 0 && <p className="text-[13px] text-muted-foreground py-2">No payment methods found.</p>}
        </div>
      </div>

      {/* Paystack section */}
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <PaystackIcon size={40} />
            <div>
              <h2 className="font-semibold">Paystack</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accept M-Pesa via STK push and card payments. Get keys from{" "}
                <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener noreferrer" className="underline">paystack.com</a>
              </p>
            </div>
          </div>
          {paystackConnected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Public Key</label>
            <Input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_test_... or pk_live_..."
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Secret Key</label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_test_... or sk_live_..."
                className="font-mono text-sm pr-9"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Stored locally on this device. Never shared.</p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={testMode} onCheckedChange={(v) => setTestMode(Boolean(v))} id="test-mode" />
            <label htmlFor="test-mode" className="text-sm">Use test mode</label>
            <span className="text-xs text-muted-foreground">(no real money, for testing)</span>
          </div>

          {paystackConnectedAt && <p className="text-xs text-muted-foreground">Last connected: {paystackConnectedAt}</p>}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSavePaystack} disabled={verifying}>
              {verifying ? "Verifying..." : paystackConnected ? "Update" : "Connect"}
            </Button>
            {paystackConnected && <Button variant="outline" onClick={handleDisconnectPaystack}>Disconnect</Button>}
          </div>
        </div>
      </div>

      {/* M-Pesa Daraja section */}
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <MpesaIcon size={40} />
            <div>
              <h2 className="font-semibold">M-Pesa Daraja (Direct)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Direct Safaricom M-Pesa STK Push — no Paystack middleman. Lower fees (0.5% vs 1.5%+KES 7). Get credentials from{" "}
                <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="underline">developer.safaricom.co.ke</a>
              </p>
            </div>
          </div>
          {darajaConnected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Consumer Key</label>
            <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="From Safaricom Developer Portal" className="font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Consumer Secret</label>
            <div className="relative">
              <Input
                type={showDarajaSecret ? "text" : "password"}
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="From Safaricom Developer Portal"
                className="font-mono text-sm pr-9"
              />
              <button onClick={() => setShowDarajaSecret(!showDarajaSecret)} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
                {showDarajaSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Passkey</label>
            <div className="relative">
              <Input
                type={showPasskey ? "text" : "password"}
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="From Safaricom Developer Portal"
                className="font-mono text-sm pr-9"
              />
              <button onClick={() => setShowPasskey(!showPasskey)} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
                {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Stored locally. Never shared.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Shortcode (Till/Paybill Number)</label>
            <Input value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="e.g. 174379" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Your M-Pesa till or paybill number registered with Safaricom.</p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={darajaTestMode} onCheckedChange={(v) => setDarajaTestMode(Boolean(v))} id="daraja-test-mode" />
            <label htmlFor="daraja-test-mode" className="text-sm">Use test mode (sandbox)</label>
            <span className="text-xs text-muted-foreground">(no real money, for testing)</span>
          </div>

          {darajaConnectedAt && <p className="text-xs text-muted-foreground">Last connected: {darajaConnectedAt}</p>}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveDaraja} disabled={verifyingDaraja}>
              {verifyingDaraja ? "Verifying..." : darajaConnected ? "Update" : "Connect"}
            </Button>
            {darajaConnected && <Button variant="outline" onClick={handleDisconnectDaraja}>Disconnect</Button>}
          </div>
        </div>
      </div>

      {/* Manual M-Pesa (Paybill / Till) */}
      <div className="border border-border rounded-lg p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <MpesaIcon size={28} />
          <div>
            <h2 className="font-semibold">Manual M-Pesa (Paybill / Till)</h2>
            <p className="text-xs text-muted-foreground">
              For paying directly to your Safaricom Paybill or Buy-Goods Till. The cashier
              reads the number to the customer and records the M-Pesa confirmation code. No API keys needed.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Paybill number</label>
            <Input value={paybillNumber} onChange={(e) => setPaybillNumber(e.target.value)} placeholder="e.g. 174379" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Paybill account hint</label>
            <Input value={paybillAccountHint} onChange={(e) => setPaybillAccountHint(e.target.value)} placeholder="e.g. your phone number, or invoice no." />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Buy Goods Till number</label>
            <Input value={tillNumber} onChange={(e) => setTillNumber(e.target.value)} placeholder="e.g. 5202020" className="font-mono" />
          </div>
        </div>
        <div className="flex gap-2 pt-3">
          <Button onClick={saveManual} disabled={savingManual}>
            {savingManual ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Setup guide */}
      <div className="border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3">Payment Provider Comparison</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="font-medium text-foreground">Paystack</span>
            <span>1.5% + KES 7 per M-Pesa tx · also supports cards</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="font-medium text-foreground">M-Pesa Daraja</span>
            <span>~0.5% Safaricom fee · M-Pesa only · no middleman</span>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            You can connect both. At POS, cashiers choose which to use per transaction.
            Paystack is easier to set up. Daraja has lower fees but requires a Safaricom
            Developer account and a registered till/paybill.
          </p>
        </div>
      </div>

      {/* Merchant fee overrides — reports use these to compute net revenue.
          Defaults match each provider's published rate but every merchant
          negotiates their own tariff so the operator can override. */}
      <div className="space-y-4 rounded-md border border-foreground/10 bg-foreground/[0.02] p-5">
        <div>
          <h2 className="text-[16px] font-medium">Service charges</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">
            How much the provider keeps per transaction. Defaults are the published rates
            (Paystack: 1.5% on M-Pesa, 2.9% on local card · Safaricom: variable, often paid by
            the customer not the merchant). Adjust to whatever your contract actually charges
            — reports compute net revenue from these.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Paystack · M-Pesa (%)
            </label>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={fees.paystack_mpesa_percent}
              onChange={(e) => setFees({ ...fees, paystack_mpesa_percent: parseFloat(e.target.value) || 0 })}
              placeholder="1.5"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Paystack · card (%)
            </label>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={fees.paystack_card_percent}
              onChange={(e) => setFees({ ...fees, paystack_card_percent: parseFloat(e.target.value) || 0 })}
              placeholder="2.9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Safaricom Daraja (%)
            </label>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={fees.daraja_percent}
              onChange={(e) => setFees({ ...fees, daraja_percent: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            size="sm"
            disabled={savingFees}
            onClick={async () => {
              setSavingFees(true)
              try {
                await savePaymentFees(fees)
                toast.success("Service charges saved")
              } catch (e) {
                toast.error(String(e))
              } finally {
                setSavingFees(false)
              }
            }}
          >
            {savingFees ? "Saving…" : "Save service charges"}
          </Button>
        </div>
      </div>
    </div>
  );
}

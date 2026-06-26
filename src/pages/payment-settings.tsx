import { useState, useEffect } from "react";
import {
  CheckCircle as CheckCircle2,
  CreditCard as CreditCard,
  DeviceMobile as Smartphone,
  Eye,
  EyeSlash as EyeOff,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getPaystackConfig, savePaystackConfig, verifyPaystackKey, disablePaystack } from "@/services/paystack";
import { getDarajaConfig, saveDarajaConfig, verifyDarajaKey, disableDaraja } from "@/services/daraja";
import { toast } from "sonner";

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

  const load = async () => {
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
        <h1 className="text-xl font-semibold tracking-tight">Payment Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure payment providers for automated processing.</p>
      </div>

      {/* Paystack section */}
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
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
            <div className="h-10 w-10 rounded-md bg-green-500/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
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
    </div>
  );
}

import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPaystackConfig, savePaystackConfig, verifyPaystackKey, disablePaystack } from "@/services/paystack";
import { toast } from "sonner";

export function PaymentSettingsPage() {
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    const config = await getPaystackConfig();
    if (config) {
      setPublicKey(config.public_key || "");
      setSecretKey(config.secret_key || "");
      setTestMode(config.test_mode === 1);
      setConnected(config.active === 1);
      setConnectedAt(config.connected_at);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
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

  const handleDisconnect = async () => {
    await disablePaystack();
    setConnected(false);
    toast.success("Paystack disconnected");
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
          {connected ? (
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
            <input
              type="checkbox"
              id="test-mode"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="test-mode" className="text-sm">Use test mode</label>
            <span className="text-xs text-muted-foreground">(no real money, for testing)</span>
          </div>

          {connectedAt && (
            <p className="text-xs text-muted-foreground">Last connected: {connectedAt}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={verifying}>
              {verifying ? "Verifying..." : connected ? "Update" : "Connect"}
            </Button>
            {connected && (
              <Button variant="outline" onClick={handleDisconnect}>Disconnect</Button>
            )}
          </div>
        </div>
      </div>

      {/* Setup guide */}
      <div className="border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3">Setting up Paystack</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Sign up for free at <a href="https://paystack.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary underline">paystack.com/signup</a></li>
          <li>Complete KYC verification (upload ID + business documents)</li>
          <li>Enable M-Pesa under Settings → Payment Channels</li>
          <li>Copy your API keys from Settings → API Keys & Webhooks</li>
          <li>Paste them above and click Connect</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-3">
          Paystack charges 1.5% + KES 7 per M-Pesa transaction. No monthly fees.
        </p>
      </div>
    </div>
  );
}

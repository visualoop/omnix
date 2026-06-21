import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CircleNotch as Loader2,
  Key as KeyRound,
  SignIn as LogIn,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { OmnixLogo } from "@/components/omnix-logo";
import { ModuleLogo } from "@/components/module-logos";
import { useActiveModule, MODULE_DEFINITIONS } from "@/stores/active-module";
import { APP_NAME } from "@/lib/brand";
import { getActiveUsernames, resetUserPassword } from "@/services/auth";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetOwnerPassword, setResetOwnerPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [usernames, setUsernames] = useState<string[]>([]);
  const signIn = useAuthStore((s) => s.signIn);
  const moduleId = useActiveModule((s) => s.active);
  const loadModule = useActiveModule((s) => s.load);
  const moduleDef = MODULE_DEFINITIONS[moduleId];
  const isModule = moduleId !== "core";

  useEffect(() => { loadModule().catch(() => {}); }, [loadModule]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Enter username and password");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username.trim().toLowerCase(), password);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReset = async () => {
    setError("");
    setResetSuccess("");
    setShowReset(true);
    try {
      const names = await getActiveUsernames();
      setUsernames(names);
      if (names.length > 0) setResetUsername(names[0]);
    } catch {
      setUsernames([]);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSuccess("");
    if (!resetUsername || !resetNewPassword || !resetOwnerPassword) {
      setError("Fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      await resetUserPassword(resetUsername, resetNewPassword, resetOwnerPassword);
      setResetSuccess(`Password reset for ${resetUsername}. You can now sign in.`);
      setShowReset(false);
      setUsername(resetUsername);
      setPassword("");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-canvas relative flex h-screen w-screen items-center justify-center p-6 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[140px]" />
      </div>
      <div className="relative z-10 w-full max-w-[380px] glass-thick rounded-glass-xl p-7 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center glass rounded-2xl p-3">
            {isModule ? (
              <ModuleLogo moduleId={moduleId} size={48} rounded />
            ) : (
              <OmnixLogo size={48} />
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight pt-2">
            {isModule ? moduleDef.name : APP_NAME}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isModule ? `Powered by ${APP_NAME} · Sign in to continue` : "Sign in to continue"}
          </p>
        </div>
        <form onSubmit={showReset ? handleResetPassword : handleLogin} className="space-y-3">
          {showReset ? (
            <>
              <label className="text-xs font-medium text-muted-foreground">User to reset</label>
              <select
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm font-mono"
              >
                {usernames.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <Input
                type="password"
                placeholder="New password (min 4 chars)"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Your password (owner only)"
                value={resetOwnerPassword}
                onChange={(e) => setResetOwnerPassword(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Only the business owner can reset passwords. Enter your owner password to authorize this reset. No internet required.
              </p>
            </>
          ) : (
            <>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="font-mono"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          {error && (
            <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
          {resetSuccess && (
            <div className="border border-green-500/50 bg-green-500/5 rounded-md p-2.5 flex items-start gap-2">
              <p className="text-xs text-green-700">{resetSuccess}</p>
            </div>
          )}
          {showReset ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl cursor-pointer" onClick={() => { setShowReset(false); setError(""); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button type="submit" className="flex-1 rounded-xl shadow-native cursor-pointer" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting...</> : <><KeyRound className="h-4 w-4 mr-2" /> Reset Password</>}
              </Button>
            </div>
          ) : (
            <>
              <Button type="submit" className="w-full h-10 rounded-xl shadow-native cursor-pointer" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
                ) : (
                  <><LogIn className="h-4 w-4 mr-2" /> Sign In</>
                )}
              </Button>
              <button type="button" onClick={handleOpenReset} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer">
                Forgot password?
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

/**
 * Idle Auto-Lock
 *
 * Locks the app after N minutes of no user activity. Important for shared
 * tills where staff walk away — prevents the next person from making
 * unauthorized sales under the previous cashier's account.
 *
 * Activity = mousemove, keydown, click, scroll, touchstart.
 * On lock, navigates to /login and clears the session.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "omnix-idle-lock-minutes";
const DEFAULT_MINUTES = 10;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function getIdleLockMinutes(): number {
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return DEFAULT_MINUTES;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MINUTES;
}

export function setIdleLockMinutes(minutes: number): void {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}

export function IdleAutoLock() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const minutes = getIdleLockMinutes();
    if (minutes === 0) return; // disabled

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setLocked(true);
      }, minutes * 60 * 1000);
    };
    reset();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, reset);
      }
    };
  }, [user]);

  if (!locked || !user) return null;

  const handleUnlock = async () => {
    if (!pin.trim()) return;
    try {
      const { signIn } = useAuthStore.getState();
      await signIn(user.username, pin);
      setLocked(false);
      setPin("");
    } catch {
      setPin("");
      // Still locked
    }
  };

  const handleSwitchUser = () => {
    signOut();
    setLocked(false);
    setPin("");
    navigate("/login");
  };

  return (
    <>
      {createPortal(
        <div className="glass-canvas fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
          {/* Atmospheric ambient orbs */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-[160px]" />
            <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-blue-500/10 blur-[180px]" />
          </div>

          <div className="relative z-10 w-full max-w-[400px] glass-thick rounded-glass-xl p-7 space-y-5">
            {/* Lock icon in a glass chip */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="glass rounded-2xl p-4">
                <Lock className="h-7 w-7 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Locked</h1>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Inactivity timeout. Enter your password to continue.
                </p>
              </div>
            </div>

            {/* Active user pill */}
            <div className="rounded-2xl glass-thin px-3.5 py-2.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
                {(user.full_name?.charAt(0) || user.username.charAt(0)).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[13px] font-medium truncate">{user.full_name || user.username}</div>
                <div className="text-[11px] text-muted-foreground truncate font-mono">{user.username}</div>
              </div>
            </div>

            {/* Password + unlock */}
            <div className="space-y-2.5">
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Password"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                className="h-10 rounded-xl"
              />
              <Button
                onClick={handleUnlock}
                className="w-full h-11 rounded-xl shadow-native cursor-pointer"
                disabled={!pin.trim()}
              >
                Unlock
              </Button>
            </div>

            <button
              onClick={handleSwitchUser}
              className="block w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
            >
              Switch user
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

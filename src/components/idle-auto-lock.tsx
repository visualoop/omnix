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
    <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-5 p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Locked</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Locked after inactivity. Enter your password to unlock.
          </p>
        </div>
        <div className="text-left space-y-2">
          <div className="px-3 py-2 rounded-md border border-border bg-muted/30 text-sm flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
              {user.full_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{user.full_name || user.username}</div>
              <div className="text-xs text-muted-foreground">{user.username}</div>
            </div>
          </div>
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Password"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          />
          <Button onClick={handleUnlock} className="w-full" disabled={!pin.trim()}>
            Unlock
          </Button>
        </div>
        <button
          onClick={handleSwitchUser}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Switch user
        </button>
      </div>
    </div>
  );
}

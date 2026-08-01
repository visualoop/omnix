import { useState, type FormEvent } from "react";
import { ArrowRight, LockKey } from "@phosphor-icons/react";
import { redeemBrowserAuthorization } from "@/web/api";

export interface WebLoginPageProps {
  readonly onAuthorized?: () => void;
}

export function WebLoginPage({ onAuthorized }: WebLoginPageProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await redeemBrowserAuthorization(code);
      if (onAuthorized) onAuthorized();
      else window.location.assign("/web");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Browser access could not be authorized.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#0a0a0b] px-5 py-8 text-zinc-100 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md" aria-labelledby="browser-login-title">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 text-blue-500">
              <path d="M5 9.5 16 3l11 6.5v13L16 29 5 22.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 12.5h12M10 16h12M10 19.5h7" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div>
              <p className="text-sm font-semibold tracking-tight">Omnix reports</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">LAN viewer / read only</p>
            </div>
          </div>
          <span className="border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">Local</span>
        </div>

        <div className="py-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400">Authorization 01</p>
          <h1 id="browser-login-title" className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em]">
            Open the reporting window.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
            Ask an owner at the Omnix desktop to authorize this browser, then enter the one-time code shown there.
          </p>
        </div>

        <form onSubmit={submit} className="border-y border-zinc-800 py-6">
          <label htmlFor="authorization-code" className="text-xs font-medium text-zinc-300">One-time authorization code</label>
          <div className="relative mt-2">
            <LockKey aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              id="authorization-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9 -]/g, "").slice(0, 48))}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck={false}
              inputMode="text"
              placeholder="0000-0000-0000-0000-0000-0000-0000-0000"
              className="h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-10 pr-3 font-mono text-sm tracking-[0.08em] outline-none transition-colors placeholder:text-[10px] placeholder:tracking-normal placeholder:text-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              aria-describedby={error ? "authorization-error" : "authorization-help"}
              aria-invalid={Boolean(error)}
            />
          </div>
          <p id="authorization-help" className="mt-2 text-xs leading-5 text-zinc-500">Codes work once and expire after ten minutes. This page cannot create or widen access.</p>
          {error && <p id="authorization-error" role="alert" className="mt-3 border-l-2 border-red-500 pl-3 text-xs leading-5 text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.replace(/[- ]/g, "").length !== 32}
            className="mt-5 flex h-11 w-full items-center justify-between rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>{busy ? "Authorizing browser…" : "Open read-only reports"}</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </form>

        <div className="flex items-start gap-3 pt-5 text-xs leading-5 text-zinc-500">
          <span className="mt-2 block size-1.5 shrink-0 rounded-full bg-blue-500" />
          <p>Business data stays on the branch network. The browser receives an HttpOnly session and no database or point-of-sale capability.</p>
        </div>
      </section>
    </main>
  );
}

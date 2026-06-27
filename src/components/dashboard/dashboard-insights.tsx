/**
 * Dashboard insight strip — the proactive "what needs attention today?"
 * surface. Reads the deterministic, offline insight engine
 * (services/insights.topFindings) and renders ranked findings in the
 * dashboard's editorial register: hairline rules, mono eyebrows, Fraunces
 * headline, no cards.
 *
 * Each finding already carries a human-readable headline + detail computed
 * in SQL (no LLM needed to show it). The ✨ button hands that one finding to
 * the AI for a plain-language "why + what to do" — narration on demand,
 * never on render. Degrades silently when AI isn't configured.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkle as Sparkles, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { topFindings, type Finding } from "@/services/insights";
import { streamInvoke, AiError } from "@/services/ai";
import { AssistantMarkdown } from "@/components/ai/AssistantMarkdown";

const SEV_DOT: Record<Finding["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-foreground/30",
};

export function DashboardInsights() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    topFindings().then(setFindings).catch(() => setFindings([]));
  }, []);

  // Nothing to show (still loading, or genuinely all-clear) → render nothing.
  if (!findings || findings.length === 0) return null;

  return (
    <section className="px-8 md:px-14 pb-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/60 pb-3 border-b border-foreground/15">
        Needs attention
      </div>
      <ul className="divide-y divide-foreground/10">
        {findings.map((f, i) => (
          <FindingRow key={`${f.kind}-${i}`} finding={f} onOpen={() => f.route && navigate(f.route)} />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({ finding, onOpen }: { finding: Finding; onOpen: () => void }) {
  const [explanation, setExplanation] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const explain = async () => {
    if (busy || explanation) return;
    setBusy(true);
    setFailed(null);
    // Hand the deterministic facts to the model; ask only for the "why + do".
    const prompt =
      `A Kenyan SME business dashboard flagged this finding:\n\n` +
      `Headline: ${finding.headline}\n` +
      `Detail: ${finding.detail}\n` +
      `Category: ${finding.kind}, severity: ${finding.severity}\n\n` +
      `In 2-3 short sentences, explain why this matters and the single most ` +
      `useful next action. Be concrete and practical. Don't restate the numbers ` +
      `verbatim; add insight. No greeting.`;
    try {
      let acc = "";
      for await (const p of streamInvoke("anomaly_narrate", [{ role: "user", content: prompt }])) {
        if (p.delta) {
          acc = p.text;
          setExplanation(acc);
        }
      }
    } catch (e) {
      if (e instanceof AiError && e.status === "no_provider") {
        setFailed("Add an AI provider in Settings → AI to get explanations.");
      } else {
        setFailed("Couldn't generate an explanation just now.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEV_DOT[finding.severity]}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="text-[18px] leading-tight tracking-[-0.01em] text-foreground"
            >
              {finding.headline}
            </h3>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={explain}
                disabled={busy}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/55 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Ask AI
              </button>
              {finding.route && (
                <button
                  type="button"
                  onClick={onOpen}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/55 hover:text-foreground transition-colors cursor-pointer"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-[13px] leading-[1.55] text-foreground/70">{finding.detail}</p>
          {explanation && (
            <div className="mt-2 pl-3 border-l-2 border-foreground/15 text-[13px] leading-[1.6] text-foreground/85">
              <AssistantMarkdown source={explanation} />
            </div>
          )}
          {failed && <p className="mt-2 text-[12px] text-foreground/50">{failed}</p>}
        </div>
      </div>
    </li>
  );
}

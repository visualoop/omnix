/**
 * approval-bus.ts — a tiny pub/sub bridge between runAgent's `onAsk`
 * callback and the ApprovalDialog React component.
 *
 * The runtime calls `approvalBus.request(...)` which:
 *   1. Creates a Deferred-style promise
 *   2. Notifies any subscribed listener (typically the ApprovalDialog)
 *   3. Awaits the user's response via `respond(...)`
 *
 * Only one dialog opens at a time. If a second request arrives while
 * one is pending, it queues behind. This keeps the UX single-modal
 * even if the model tries to fire multiple write tools back-to-back.
 */
import type { ToolTier } from "../tools/base";

export interface ApprovalRequest {
  tool: string;
  summary: string;
  detail?: string;
  tier: ToolTier;
  respond(answer: { approved: boolean }): void;
}

type Listener = (req: ApprovalRequest | null) => void;

const listeners = new Set<Listener>();
let current: ApprovalRequest | null = null;
const queue: ApprovalRequest[] = [];

function notify() {
  for (const l of listeners) l(current);
}

function drain() {
  if (current) return;
  const next = queue.shift();
  if (next) {
    current = next;
    notify();
  }
}

export const approvalBus = {
  request(input: { tool: string; summary: string; detail?: string; tier: ToolTier }): Promise<{ approved: boolean }> {
    return new Promise((resolve) => {
      const req: ApprovalRequest = {
        ...input,
        respond(answer) {
          resolve(answer);
          current = null;
          drain();
        },
      };
      if (current) {
        queue.push(req);
      } else {
        current = req;
        notify();
      }
    });
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
  },
};

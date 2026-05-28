/**
 * Imperative confirm dialog using shadcn/base-ui Dialog.
 *
 * Replaces window.confirm() with a native-styled modal.
 *
 * Usage:
 *   const ok = await confirm({
 *     title: "Cancel transfer?",
 *     description: "This action cannot be undone.",
 *     confirmText: "Cancel",
 *     variant: "destructive",
 *   });
 *   if (!ok) return;
 *
 * Mount once at app root:
 *   <ConfirmDialogHost />
 */
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "warning";
}

interface PromptOptions {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
}

interface DialogState {
  type: "confirm" | "prompt" | null;
  options: ConfirmOptions | PromptOptions | null;
  resolver: ((value: any) => void) | null;
  open: (type: "confirm" | "prompt", options: any, resolver: (v: any) => void) => void;
  close: () => void;
}

const useDialogStore = create<DialogState>((set) => ({
  type: null,
  options: null,
  resolver: null,
  open: (type, options, resolver) => set({ type, options, resolver }),
  close: () => set({ type: null, options: null, resolver: null }),
}));

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().open("confirm", options, resolve);
  });
}

export function prompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().open("prompt", options, resolve);
  });
}

export function ConfirmDialogHost() {
  const { type, options, resolver, close } = useDialogStore();
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");

  // Reset text when prompt opens
  useEffect(() => {
    if (type === "prompt") {
      setText(((options as PromptOptions)?.defaultValue) || "");
    }
  }, [type, options]);

  if (!type || !options) return null;

  const isDestructive = (options as ConfirmOptions).variant === "destructive";
  const isWarning = (options as ConfirmOptions).variant === "warning";

  const handleConfirm = async () => {
    if (!resolver) return;
    if (type === "prompt") {
      const value = text.trim();
      const opts = options as PromptOptions;
      if (opts.required && !value) return;
      setSubmitting(true);
      resolver(value || null);
    } else {
      setSubmitting(true);
      resolver(true);
    }
    setSubmitting(false);
    close();
  };

  const handleCancel = () => {
    if (resolver) resolver(type === "prompt" ? null : false);
    close();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`shrink-0 rounded-full p-1.5 ${
              isDestructive ? "bg-red-100 text-red-600" :
              isWarning ? "bg-amber-100 text-amber-600" :
              "bg-blue-100 text-blue-600"
            }`}>
              {isDestructive || isWarning ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <HelpCircle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>{options.title}</DialogTitle>
              {options.description && (
                <DialogDescription className="mt-1.5">
                  {options.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {type === "prompt" && (
          <div className="pl-10">
            <input
              type="text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={(options as PromptOptions).placeholder}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
                if (e.key === "Escape") handleCancel();
              }}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={submitting}>
            {options.cancelText || "Cancel"}
          </Button>
          <Button
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={submitting || (type === "prompt" && (options as PromptOptions).required && !text.trim())}
            autoFocus
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {options.confirmText || (type === "prompt" ? "Submit" : "Continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

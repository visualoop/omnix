/**
 * Business-info loader for PDF chrome.
 *
 * Reads the same six `business.*` settings every PDF needs and returns
 * a `BrandHeader` ready to pass to the pdf-engine. Centralised here
 * so adding a new field (e.g. tagline, phone secondary) is one change
 * instead of scattered across every PDF service.
 */
import { toast } from "sonner"
import type { BrandHeader } from "@/services/pdf-engine"
import { getBusinessProfile } from "@/services/business-profile"

/**
 * Build the PDF brand header from the canonical business profile.
 *
 * Previously this read `business.*` keys from the `settings` table —
 * keys that nothing ever wrote — so every PDF showed "Your Business".
 * Now it reads the real `business` table (+ etims_config KRA PIN) via
 * getBusinessProfile(). The "Your Business" fallback only appears when
 * the business genuinely hasn't been named, which setup.tsx prevents.
 */
export async function loadBrandHeader(): Promise<BrandHeader> {
  const p = await getBusinessProfile()
  return {
    businessName: p.name || "Your Business",
    address: p.address,
    phone: p.phone,
    email: p.email,
    kraPin: p.kraPin,
    logoPath: p.logoPath,
    website: p.website,
  }
}

/**
 * Side-effecting helper: take rendered PDF bytes and dispatch to the
 * browser as a download. Used by every download<X>Pdf wrapper.
 *
 * Toasts success so the user gets a clear confirmation. Wraps in
 * try/catch so a download failure surfaces an error toast instead of
 * silently failing.
 */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const fullName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fullName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("PDF downloaded", { description: fullName })
  } catch (e) {
    toast.error("Couldn't download PDF", {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

/** Open PDF bytes in a new browser tab (Tauri webview shows native PDF viewer). */
export function previewBytes(bytes: Uint8Array): void {
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const opened = window.open(url, "_blank", "noopener,noreferrer")
    if (!opened) {
      toast.error("Pop-up blocked", {
        description: "Allow pop-ups for omnix to preview PDFs.",
      })
    }
    // Don't revoke immediately — give the new tab time to load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.error("Couldn't preview PDF", {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

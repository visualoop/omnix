/**
 * Business-info loader for PDF chrome.
 *
 * Reads the same six `business.*` settings every PDF needs and returns
 * a `BrandHeader` ready to pass to the pdf-engine. Centralised here
 * so adding a new field (e.g. tagline, phone secondary) is one change
 * instead of scattered across every PDF service.
 */
import { query } from "@/lib/db"
import type { BrandHeader } from "@/services/pdf-engine"

export async function loadBrandHeader(): Promise<BrandHeader> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN (
       'business.name','business.address','business.phone','business.email',
       'business.kra_pin','business.logo_path','business.website'
     )`,
  )
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    businessName: map["business.name"] || "Your Business",
    address: map["business.address"] || null,
    phone: map["business.phone"] || null,
    email: map["business.email"] || null,
    kraPin: map["business.kra_pin"] || null,
    logoPath: map["business.logo_path"] || null,
    website: map["business.website"] || null,
  }
}

/**
 * Side-effecting helper: take rendered PDF bytes and dispatch to the
 * browser as a download. Used by every download<X>Pdf wrapper.
 */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Open PDF bytes in a new browser tab (Tauri webview shows native PDF viewer). */
export function previewBytes(bytes: Uint8Array): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  // Don't revoke immediately — give the new tab time to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

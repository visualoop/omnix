"use client";

/**
 * ShareDocMenu — one control to Download / Print / WhatsApp / Email any
 * generated document (purchase orders, invoices, quotations, receipts,
 * statements). Reused everywhere so document sharing is consistent.
 *
 * Reality check: wa.me and mailto: links CANNOT pre-attach a file. So the
 * WhatsApp/Email actions download the PDF first (so it's ready on disk) and
 * then open the chat/compose window prefilled with a message — the user
 * attaches the just-downloaded file. A toast tells them to do so.
 *
 * Usage:
 *   <ShareDocMenu
 *     getPdf={() => buildPurchaseOrderPdf(po, items)}
 *     filename={`PO-${po.po_number}`}
 *     phone={supplier.phone}
 *     email={supplier.email}
 *     subject={`Purchase Order ${po.po_number}`}
 *     message={`Hello ${supplier.name}, please find our purchase order ${po.po_number} (total KES ${po.total}). PDF attached.`}
 *   />
 */
import { useState } from "react";
import {
  Share as ShareIcon,
  DownloadSimple,
  Printer,
  WhatsappLogo,
  EnvelopeSimple,
  CircleNotch,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { downloadBytes, previewBytes } from "@/services/pdf-brand";
import { toIntlDigits } from "@/lib/phone";
import { toast } from "sonner";

interface Props {
  /** Renders the document to PDF bytes on demand (lazy — only when an action runs). */
  getPdf: () => Promise<Uint8Array>;
  /** File name (with or without .pdf). */
  filename: string;
  /** Recipient phone (any local/intl format) — enables WhatsApp. */
  phone?: string | null;
  /** Recipient email — enables Email. */
  email?: string | null;
  /** Prefilled WhatsApp/email body. */
  message: string;
  /** Email subject (defaults to the filename). */
  subject?: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function ShareDocMenu({
  getPdf, filename, phone, email, message, subject, label = "Share", size = "sm", variant = "outline", className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const waDigits = toIntlDigits(phone);

  const withPdf = async (after?: (bytes: Uint8Array) => void) => {
    setBusy(true);
    try {
      const bytes = await getPdf();
      after?.(bytes);
    } catch (e) {
      toast.error("Couldn't generate the document", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const doDownload = () => withPdf((bytes) => downloadBytes(bytes, filename));
  const doPrint = () => withPdf((bytes) => previewBytes(bytes));

  const doWhatsApp = () => withPdf(async (bytes) => {
    // Save the PDF so it's ready to attach, then open the chat prefilled.
    downloadBytes(bytes, filename);
    const base = waDigits ? `https://wa.me/${waDigits}` : "https://wa.me/";
    const url = `${base}?text=${encodeURIComponent(message)}`;
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    toast.info("Attach the downloaded PDF in WhatsApp", { description: "Links can't auto-attach files — the PDF is in your downloads." });
  });

  const doEmail = () => withPdf(async (bytes) => {
    downloadBytes(bytes, filename);
    const subj = encodeURIComponent(subject || filename);
    const body = encodeURIComponent(message);
    const url = `mailto:${email ?? ""}?subject=${subj}&body=${body}`;
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    toast.info("Attach the downloaded PDF to the email", { description: "The PDF is in your downloads." });
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} size={size} className={className} disabled={busy} />}>
        {busy ? <CircleNotch className="h-4 w-4 mr-1.5 animate-spin" /> : <ShareIcon className="h-4 w-4 mr-1.5" />}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={doDownload}><DownloadSimple className="h-4 w-4 mr-2" /> Download PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={doPrint}><Printer className="h-4 w-4 mr-2" /> Print</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={doWhatsApp}>
          <WhatsappLogo className="h-4 w-4 mr-2 text-[#25D366]" /> {waDigits ? "Send on WhatsApp" : "Open WhatsApp"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doEmail}>
          <EnvelopeSimple className="h-4 w-4 mr-2" /> Email{email ? "" : "…"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

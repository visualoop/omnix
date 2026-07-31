import type { ReceiptData } from "@/services/receipt";
import { money } from "@/lib/money";

export type ReceiptShareResult = "shared" | "copied";

export function buildReceiptShareText(receipt: ReceiptData): string {
  const itemCount = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
  const lines = [
    receipt.business.name,
    `Receipt #${receipt.sale.sale_number}`,
    `${itemCount} item${itemCount === 1 ? "" : "s"} · ${money(receipt.total)}`,
  ];

  if (receipt.customer?.name) lines.push(`Customer: ${receipt.customer.name}`);
  if (receipt.kra?.invoice_no) lines.push(`KRA invoice: ${receipt.kra.invoice_no}`);
  if (receipt.footer) lines.push(receipt.footer);
  return lines.join("\n");
}

export async function shareReceipt(receipt: ReceiptData): Promise<ReceiptShareResult> {
  const text = buildReceiptShareText(receipt);
  const title = `${receipt.business.name} receipt #${receipt.sale.sale_number}`;

  if (typeof navigator.share === "function") {
    await navigator.share({ title, text });
    return "shared";
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error("Sharing is unavailable on this device");
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}

import QRCode from "qrcode";

export interface ShelfLabelData {
  product_name: string;
  barcode: string;
  price: number;
  unit: string;
}

export async function printShelfLabels(labels: ShelfLabelData[]): Promise<void> {
  const html = await renderLabelsHTML(labels);

  // Open in new window for print dialog
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    setTimeout(() => w.print(), 200);
  };
}

async function renderLabelsHTML(labels: ShelfLabelData[]): Promise<string> {
  const labelsHtml = await Promise.all(labels.map(async (l) => {
    const qrUrl = l.barcode
      ? await generateBarcodeQr(l.barcode)
      : "";
    return `
    <div class="label">
      <div class="name">${escapeHtml(l.product_name)}</div>
      ${qrUrl ? `<div class="barcode"><img src="${qrUrl}" width="120" height="120" alt="${escapeHtml(l.barcode)}" /></div>` : ""}
      <div class="barcode-text">${escapeHtml(l.barcode)}</div>
      <div class="price">KES ${l.price.toFixed(2)} <span class="unit">/ ${escapeHtml(l.unit)}</span></div>
    </div>`;
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Shelf Labels</title>
<style>
  @page {
    size: 62mm 35mm;
    margin: 2mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
  }
  .label {
    width: 58mm;
    height: 31mm;
    border: 1px solid #000;
    padding: 2mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    page-break-inside: avoid;
  }
  .name {
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    max-height: 24px;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .barcode { margin: 1mm 0; }
  .barcode img { display: block; }
  .barcode-text {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 1px;
  }
  .price {
    font-size: 12px;
    font-weight: 700;
  }
  .unit {
    font-size: 8px;
    font-weight: 400;
    color: #555;
  }
  @media print {
    body { background: #fff; }
  }
</style>
</head>
<body>
${labelsHtml.join("")}
</body>
</html>`;
}

async function generateBarcodeQr(barcode: string): Promise<string> {
  try {
    return await QRCode.toDataURL(barcode, {
      width: 140,
      margin: 1,
      color: { dark: "#000", light: "#fff" },
    });
  } catch {
    return "";
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

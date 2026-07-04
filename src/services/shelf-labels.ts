import { printHtml } from "./print-html";

export interface ShelfLabelData {
  product_name: string;
  barcode: string;
  price: number;
  unit: string;
}

export async function printShelfLabels(labels: ShelfLabelData[]): Promise<void> {
  const html = await renderLabelsHTML(labels);

  printHtml(html);
}

async function renderLabelsHTML(labels: ShelfLabelData[]): Promise<string> {
  const labelsHtml = labels.map((l) => {
    const svg = l.barcode ? code128Svg(l.barcode) : "";
    return `
    <div class="label">
      <div class="name">${escapeHtml(l.product_name)}</div>
      ${svg ? `<div class="barcode">${svg}</div>` : ""}
      <div class="barcode-text">${escapeHtml(l.barcode)}</div>
      <div class="price">KES ${l.price.toFixed(2)} <span class="unit">/ ${escapeHtml(l.unit)}</span></div>
    </div>`;
  });

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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


/**
 * Minimal Code128-B barcode → inline SVG (RT-14). Scannable by standard 1D
 * laser/CCD retail scanners, unlike the QR codes shelf labels used before.
 * Self-contained (no dependency): encodes ASCII 32..126 in Code Set B.
 */
const CODE128_PATTERNS = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110",
  "10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","1100011101011",
];

function code128Svg(data: string): string {
  const START_B = 104, STOP = 106;
  const values: number[] = [START_B];
  for (const ch of data) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) continue; // skip non-Code-B chars
    values.push(code - 32);
  }
  // Checksum: (start + sum(value_i * i)) mod 103, i starting at 1 for data.
  let sum = START_B;
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(STOP);

  const modules = values.map((v) => CODE128_PATTERNS[v]).join("");
  const moduleW = 1.2; // px per module
  const height = 46;
  let x = 0;
  const rects: string[] = [];
  for (const bit of modules) {
    if (bit === "1") rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${moduleW}" height="${height}" fill="#000"/>`);
    x += moduleW;
  }
  const width = x;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(1)}" height="${height}" viewBox="0 0 ${width.toFixed(1)} ${height}">${rects.join("")}</svg>`;
}

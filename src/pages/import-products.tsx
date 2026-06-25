import { useState } from "react";
import {
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  Download,
  FileXls as FileSpreadsheet,
  UploadSimple as Upload,
  WarningCircle as AlertCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createProduct, type CreateProductInput } from "@/services/inventory";
import { toast } from "sonner";
import { AiButton } from "@/components/ai/AiButton";
import { ai } from "@/services/ai";
import { mapHeaders, projectRow } from "@/services/csv-automap";

interface ParsedRow {
  rowIndex: number;
  data: CreateProductInput;
  errors: string[];
}

const CSV_TEMPLATE = `name,sku,barcode,unit,buying_price,selling_price,initial_stock,reorder_level,tax_rate
Paracetamol 500mg,PCM500,8901234567890,tablet,2.50,5.00,100,20,0
Amoxicillin 250mg,AMX250,8901234567891,capsule,8.00,15.00,50,10,0
Bandage Roll,BND01,,piece,30.00,60.00,20,5,16
`;

export function ImportProductsPage() {
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ success: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    parseCSV(text);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setParsed([]);
      return;
    }

    // Auto-map headers — supports English + Swahili + casing/punctuation variation.
    // E.g. "Bidhaa, Bei ya Kununua, Bei ya Kuuza" → name, buying_price, selling_price.
    const rawHeaders = parseCSVLine(lines[0]);
    const { mapped, missingRequired, unmappedHeaders } = mapHeaders(rawHeaders);
    if (missingRequired.length > 0) {
      toast.error(`Missing required columns: ${missingRequired.join(", ")}`, {
        description: rawHeaders.length
          ? `We saw: ${rawHeaders.join(", ")}. Couldn't map: ${unmappedHeaders.join(", ") || "(none)"}.`
          : undefined,
      });
      setParsed([]);
      return;
    }
    if (unmappedHeaders.length > 0) {
      toast.warning(`Skipped ${unmappedHeaders.length} unrecognised column${unmappedHeaders.length > 1 ? "s" : ""}: ${unmappedHeaders.join(", ")}`);
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      const row = projectRow(cells, mapped);

      const errors: string[] = [];
      if (!row.name) errors.push("Name required");
      const buyingPrice = parseFloat(row.buying_price ?? "");
      const sellingPrice = parseFloat(row.selling_price ?? "");
      if (isNaN(buyingPrice) || buyingPrice < 0) errors.push("Invalid buying_price");
      if (isNaN(sellingPrice) || sellingPrice < 0) errors.push("Invalid selling_price");

      const data: CreateProductInput = {
        name: row.name ?? "",
        sku: row.sku || undefined,
        barcode: row.barcode || undefined,
        unit: row.unit || "piece",
        description: row.description || undefined,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        initial_stock: row.initial_stock ? parseFloat(row.initial_stock) : 0,
        reorder_level: row.reorder_level ? parseFloat(row.reorder_level) : 0,
        tax_rate: row.tax_rate ? parseFloat(row.tax_rate) : 0,
      };

      rows.push({ rowIndex: i + 1, data, errors });
    }
    setParsed(rows);
    setImported(null);
  };

  const handleImport = async () => {
    const valid = parsed.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of valid) {
      try {
        await createProduct(row.data);
        success++;
      } catch (e) {
        console.error("Import row failed:", row.data.name, e);
        failed++;
      }
    }

    setImporting(false);
    setImported({ success, failed });

    if (failed === 0) {
      toast.success(`Imported ${success} products`);
    } else {
      toast.error(`Imported ${success}, failed ${failed}`);
    }
  };

  const validCount = parsed.filter((r) => r.errors.length === 0).length;
  const errorCount = parsed.length - validCount;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Import Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk import products from a CSV file
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AiButton
            label="Auto-map columns"
            hint="Let AI map your CSV's headers to Omnix fields"
            disabled={!csvText.trim()}
            onRun={async () => {
              const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
              if (lines.length === 0) { toast.error("Upload or paste a CSV first"); return; }
              const headers = lines[0].split(",").map((h) => h.trim());
              const mappings = await ai.normalizeImport(headers);
              const newHeaders = headers.map((h) => {
                const m = mappings.find((mm) => mm.source_header === h);
                return m?.target_field ?? h.toLowerCase();
              });
              const rest = lines.slice(1).join("\n");
              const newCsv = newHeaders.join(",") + "\n" + rest;
              setCsvText(newCsv);
              parseCSV(newCsv);
              const matched = mappings.filter((m) => m.target_field).length;
              toast.success(`Mapped ${matched}/${headers.length} columns`, {
                description: "Review the preview rows below before importing.",
              });
            }}
          />
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </div>
      </div>

      {imported ? (
        <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-5 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Import Complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              {imported.success} products imported successfully
              {imported.failed > 0 && `, ${imported.failed} failed`}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => { setParsed([]); setCsvText(""); setImported(null); }}>
                Import Another File
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Upload CSV file</p>
            <p className="text-xs text-muted-foreground mb-4">
              Required columns: name, buying_price, selling_price.
              <br />
              Optional: sku, barcode, unit, initial_stock, reorder_level, tax_rate, description
            </p>
            <label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" /> Choose File
              </span>
            </label>
          </div>

          {/* Or paste CSV */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Or paste CSV text:</label>
            <Textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); parseCSV(e.target.value); }}
              placeholder={CSV_TEMPLATE}
              className="w-full min-h-[160px] rounded-md border border-input bg-transparent p-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-green-500/50 text-green-700">
                    {validCount} valid
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="outline" className="border-red-500/50 text-red-700">
                      {errorCount} errors
                    </Badge>
                  )}
                </div>
                <Button onClick={handleImport} disabled={importing || validCount === 0}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                  ) : (
                    <>Import {validCount} Products</>
                  )}
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium w-10">#</th>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">SKU</th>
                      <th className="text-right px-3 py-2 font-medium">Buy</th>
                      <th className="text-right px-3 py-2 font-medium">Sell</th>
                      <th className="text-right px-3 py-2 font-medium">Stock</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 100).map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={`border-b border-border last:border-0 ${
                          row.errors.length > 0 ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground text-xs font-mono">{row.rowIndex}</td>
                        <td className="px-3 py-2">{row.data.name || <span className="text-red-600">—</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.data.sku || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.data.buying_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.data.selling_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.data.initial_stock ?? 0}</td>
                        <td className="px-3 py-2 text-center">
                          {row.errors.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                          ) : (
                            <span title={row.errors.join(", ")}>
                              <X className="h-4 w-4 text-red-600 inline" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 100 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/20">
                    Showing first 100 of {parsed.length} rows
                  </div>
                )}
              </div>

              {errorCount > 0 && (
                <details className="border border-amber-500/50 bg-amber-500/5 rounded-md p-3">
                  <summary className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Errors in {errorCount} rows
                  </summary>
                  <div className="mt-2 space-y-1">
                    {parsed.filter((r) => r.errors.length > 0).slice(0, 20).map((row) => (
                      <div key={row.rowIndex} className="text-xs">
                        <span className="font-mono text-muted-foreground">Row {row.rowIndex}:</span>{" "}
                        <span className="text-red-700">{row.errors.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Minimal CSV parser handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

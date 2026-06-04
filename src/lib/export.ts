/**
 * Lightweight CSV export — no dependencies needed.
 */
import { toast } from "sonner";

export function exportToCSV(filename: string, rows: Array<Record<string, unknown>> | unknown[]) {
  const data = rows as Array<Record<string, unknown>>;
  if (data.length === 0) {
    toast.warning("Nothing to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    ),
  ].join("\n");

  const fullName = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fullName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success(`Exported ${data.length} row${data.length === 1 ? "" : "s"}`, {
    description: fullName,
  });
}

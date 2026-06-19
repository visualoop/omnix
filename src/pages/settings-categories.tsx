/**
 * Categories management — /settings/categories
 *
 * Owner CRUD over the shared categories table. Categories drive the
 * filter on /inventory and the chip on every product row. Without this
 * page, owners had no way to rename or remove a category once created
 * inline from the product panel.
 *
 * Design notes (frontend-design skill, anti-slop-writing):
 *   - Single column, generous spacing. Categories are a flat list — no
 *     need for kanban or grid card view.
 *   - Inline edit on row click. No separate edit dialog — too many
 *     dialogs makes data feel locked away.
 *   - Show product count per category so the owner sees which
 *     categories are heavily used vs empty.
 *   - 'Plain' empty-state copy: "No categories yet. Add one below."
 *     Not "Get started by creating your first category!" or any other
 *     marketing-flavoured copy.
 */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from "@/services/inventory";

interface CategoryWithCount extends Category {
  product_count?: number;
}

export function CategoriesSettingsPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const cats = (await getCategories()) as CategoryWithCount[];
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const startEdit = (c: CategoryWithCount) => {
    setEditingId(c.id);
    setEditName(c.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };
  const saveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await updateCategory(id, trimmed);
      toast.success("Category renamed");
      cancelEdit();
      await reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createCategory(trimmed);
      setNewName("");
      toast.success("Category added");
      await reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: CategoryWithCount) => {
    const ok = await confirm({
      title: `Delete '${c.name}'?`,
      description:
        c.product_count && c.product_count > 0
          ? `${c.product_count} product${c.product_count === 1 ? "" : "s"} will be left without a category. They keep selling at their current price — only the category label drops.`
          : "Permanent. The category is removed from the dropdown everywhere.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteCategory(c.id);
      toast.success("Category deleted");
      await reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-[20px] font-semibold tracking-tight">Categories</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Group products by type. Categories appear as filter chips on the inventory list and
          as a Combobox in the product editor.
        </p>
      </header>

      {/* Add new — at top so the action is always one tab away */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
          }}
        />
        <Button
          onClick={handleAdd}
          disabled={busy || !newName.trim()}
          size="sm"
          className="shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">No categories yet. Add one above.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-right px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Products</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="px-3.5 py-2">
                    {editingId === c.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); void saveEdit(c.id); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="h-7 text-[13px]"
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-muted-foreground">
                    {c.product_count ?? 0}
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => saveEdit(c.id)}
                          disabled={busy || !editName.trim()}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={cancelEdit}
                          className="text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100">
                        <Button size="icon-xs" variant="ghost" onClick={() => startEdit(c)} title="Rename">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleDelete(c)}
                          title="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

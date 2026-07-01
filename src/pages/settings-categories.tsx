/**
 * Categories management — /settings/categories AND inventory hub Categories tab.
 *
 * Tree-aware editor. The schema already supports parent_id (arbitrary depth).
 * The UI:
 *   - Top-level categories at the root
 *   - Each parent can be expanded / collapsed via a chevron
 *   - Indent grows by 18 px per depth level
 *   - Three per-row actions: rename · add subcategory · delete
 *   - 'Add at root' button at the top
 *
 * Why tree (not flat): owners think in groups — "Pharmaceuticals → Antibiotics →
 * Penicillin family". A flat list breaks that mental model and forces them to
 * fake-prefix every category name ("Pharma · Antibiotics · Penicillin"), which
 * is ugly and breaks filter chips.
 *
 * Design (frontend-design + emil-design-eng + anti-slop-writing):
 *   - Hairline rules between rows; no card containers
 *   - Mono caption for product counts (tabular-nums for column alignment)
 *   - Inline edit on click of the rename action; ESC cancels, Enter saves
 *   - Delete-with-warning if products would be orphaned
 *   - Drag-to-reparent intentionally out of scope (rare action; users can
 *     edit and re-pick parent). Add later if friction is real.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Check,
  ArrowBendDownRight as CornerDownRight,
  Pencil,
  Plus,
  Trash as Trash2,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { confirm, prompt } from "@/components/ui/confirm-dialog";
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

interface TreeNode extends CategoryWithCount {
  children: TreeNode[];
  depth: number;
}

/** Build a tree from a flat list. Roots are nodes whose parent_id is null
 *  OR whose parent isn't in the visible set (orphans float to root). */
function buildTree(rows: CategoryWithCount[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [], depth: 0 }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Re-walk to set depth on grandchildren after roots are known.
  const walk = (n: TreeNode, d: number) => {
    n.depth = d;
    n.children.forEach((c) => walk(c, d + 1));
  };
  roots.forEach((r) => walk(r, 0));
  // Sort each level by sort_order then name.
  const sortLevel = (arr: TreeNode[]) => {
    arr.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    arr.forEach((n) => sortLevel(n.children));
  };
  sortLevel(roots);
  return roots;
}

export function CategoriesSettingsPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const tree = useMemo(() => buildTree(categories), [categories]);

  // For the "parent" Combobox in the add-form: every existing category
  // qualifies as a parent option.
  const parentOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories],
  );

  const startEdit = (c: CategoryWithCount) => {
    setEditingId(c.id);
    setEditName(c.name);
  };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };
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

  const handleAdd = async (parentId?: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createCategory(trimmed, parentId ?? newParent ?? undefined);
      setNewName("");
      setNewParent(null);
      toast.success(parentId ? "Subcategory added" : "Category added");
      await reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddChild = async (parent: CategoryWithCount) => {
    const name = (await prompt({
      title: `Add subcategory under "${parent.name}"`,
      placeholder: "Subcategory name",
      required: true,
    }))?.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createCategory(name, parent.id);
      toast.success(`Added "${name}" under "${parent.name}"`);
      // Make sure the parent is expanded so the new child is visible.
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(parent.id);
        return next;
      });
      await reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: CategoryWithCount, hasChildren: boolean) => {
    const ok = await confirm({
      title: `Delete '${c.name}'?`,
      description: hasChildren
        ? "This category has subcategories. They'll be promoted to the level above."
        : c.product_count && c.product_count > 0
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

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Flatten tree into rendered rows respecting collapsed state.
  const visibleRows: TreeNode[] = useMemo(() => {
    const out: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        out.push(n);
        if (!collapsed.has(n.id)) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, collapsed]);

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-[20px] font-semibold tracking-tight">Categories</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Group products by type. Categories support subcategories — pharma-
          ceuticals can hold antibiotics, hardware can hold plumbing, plumbing
          can hold pipes. Use indentation to model how you actually shop.
        </p>
      </header>

      {/* Add new — at top so the action is always one tab away */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
          }}
        />
        <div className="sm:w-[220px]">
          <Combobox
            options={parentOptions}
            value={newParent ?? ""}
            onChange={(v) => setNewParent(v || null)}
            placeholder="Top level"
            emptyText="No parent categories"
          />
        </div>
        <Button
          onClick={() => handleAdd()}
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
      ) : tree.length === 0 ? (
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
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((c) => {
                const hasChildren = c.children.length > 0;
                const isCollapsed = collapsed.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className="group border-b border-border/50 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3.5 py-2">
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: c.depth * 18 }}
                      >
                        {hasChildren ? (
                          <button
                            onClick={() => toggleCollapse(c.id)}
                            className="size-5 grid place-items-center text-muted-foreground hover:text-foreground"
                            title={isCollapsed ? "Expand" : "Collapse"}
                          >
                            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        ) : c.depth > 0 ? (
                          <span className="size-5 grid place-items-center text-muted-foreground/40">
                            <CornerDownRight className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="size-5" />
                        )}
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
                          <span className={c.depth === 0 ? "font-medium" : ""}>{c.name}</span>
                        )}
                      </div>
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
                          <Button size="icon-xs" variant="ghost" onClick={cancelEdit} className="text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button size="icon-xs" variant="ghost" onClick={() => handleAddChild(c)} title="Add subcategory">
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="icon-xs" variant="ghost" onClick={() => startEdit(c)} title="Rename">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDelete(c, hasChildren)}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

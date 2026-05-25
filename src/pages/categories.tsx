import { useState, useEffect } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategories, createCategory, type Category } from "@/services/inventory";
import { toast } from "sonner";

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");

  const load = () => getCategories().then(setCategories);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCategory(newName.trim());
    setNewName("");
    toast.success("Category created");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Categories</h1>

      {/* Add form */}
      <div className="flex gap-2 max-w-sm">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {categories.length === 0 ? (
        <div className="py-12 text-center">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No categories yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.product_count ?? 0} products
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Price list settings page.
 * Manage retail price tiers and assign products.
 */
import { useEffect, useState } from "react";
import {
  Plus,
  Tag,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPriceLists, upsertPriceList, type PriceList } from "@/services/retail";
import { toast } from "sonner";

export function PriceListSettingsPage() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listPriceLists().then((l) => { setLists(l); setLoading(false); });
  }, []);

  const addList = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Enter a name"); return; }
    try {
      await upsertPriceList({ name });
      toast.success("Price list added");
      setNewName("");
      listPriceLists().then(setLists);
    } catch (e) { toast.error(String(e)); }
  };

  const toggleActive = async (id: string, newActive: boolean) => {
    const list = lists.find((l) => l.id === id);
    if (!list) return;
    await upsertPriceList({ id, name: list.name, active: newActive ? 1 : 0 });
    listPriceLists().then(setLists);
    toast.success(newActive ? "Activated" : "Deactivated");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" /> Price Lists
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Create price tiers. Assign customers to a price list and products get the right price automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New price list name..."
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && addList()}
        />
        <Button size="sm" onClick={addList}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-1.5">
        {lists.map((list) => (
          <div key={list.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-sm">
            <div>
              <span className="font-medium">{list.name}</span>
              {list.is_default ? <span className="ml-2 text-[10px] text-muted-foreground">(default)</span> : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px]"
              onClick={() => toggleActive(list.id, !list.active)}
            >
              {list.active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ))}
        {lists.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No price lists yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}

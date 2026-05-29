import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  currentValue: number;
  onSet: (value: number) => void;
}

export function QtyMultiplierDialog({ open, onClose, currentValue, onSet }: Props) {
  const [value, setValue] = useState(currentValue.toString());

  useEffect(() => {
    if (open) setValue(currentValue.toString());
  }, [open, currentValue]);

  const handleSubmit = () => {
    const n = parseInt(value, 10);
    if (n > 0 && n <= 99) {
      onSet(n);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quantity Multiplier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Next item added will use this quantity (1-99)
          </p>
          <Input
            type="number"
            min="1"
            max="99"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit}>Set</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

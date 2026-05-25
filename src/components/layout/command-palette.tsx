import { useEffect } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Pill,
  BarChart3,
  Settings,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pages = [
  { name: "Dashboard", to: "/", icon: LayoutDashboard },
  { name: "POS", to: "/pos", icon: ShoppingCart },
  { name: "Inventory", to: "/inventory", icon: Package },
  { name: "Pharmacy", to: "/pharmacy", icon: Pill },
  { name: "Reports", to: "/reports", icon: BarChart3 },
  { name: "Settings", to: "/settings", icon: Settings },
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="relative z-50 w-full max-w-[480px] rounded-lg border border-border bg-popover shadow-lg"
        onKeyDown={(e) => {
          if (e.key === "Escape") onOpenChange(false);
        }}
      >
        <Command.Input
          placeholder="Type a command or search..."
          className="h-11 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
        <Command.List className="max-h-[300px] overflow-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
          <Command.Group heading="Navigation" className="text-xs text-muted-foreground px-2 py-1.5">
            {pages.map((page) => (
              <Command.Item
                key={page.to}
                value={page.name}
                onSelect={() => {
                  navigate(page.to);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <page.icon className="h-4 w-4 text-muted-foreground" />
                {page.name}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

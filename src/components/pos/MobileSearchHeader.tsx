import type { RefObject } from "react";
import { Barcode, MagnifyingGlass as Search, X } from "@phosphor-icons/react";

interface MobileSearchHeaderProps {
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onScanRequest?: () => void;
}

export function MobileSearchHeader({ value, inputRef, onChange, onScanRequest }: MobileSearchHeaderProps) {
  const requestScan = () => {
    if (onScanRequest) onScanRequest();
    else inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background" role="search">
      <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Search products</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onChange("");
            }
          }}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search name, SKU, barcode"
          className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground active:scale-[0.97] motion-reduce:transform-none"
            aria-label="Clear product search"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </label>
      <button
        type="button"
        onClick={requestScan}
        className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-foreground text-background active:scale-[0.97] motion-reduce:transform-none"
        aria-label="Scan a product barcode"
      >
        <Barcode className="size-6" />
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { CloudCheck, CloudSlash, MapPin } from "@phosphor-icons/react";
import { useActiveBranch } from "@/stores/active-branch";

interface RouteContextBarProps {
  branchName: string;
  online: boolean;
}

const MOBILE_OPERATIONAL_STYLES = `
main[data-mobile-operational-route] [data-mobile-table-tools] {
  display: none;
}

@media (max-width: 1023px) {
  main[data-mobile-operational-route] [data-mobile-table-tools] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-block: 0.5rem;
  }

  main[data-mobile-operational-route] [data-mobile-table-tools] input {
    min-width: min(100%, 14rem);
    flex: 1 1 14rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.375rem;
    background: hsl(var(--background));
    padding-inline: 0.75rem;
    color: hsl(var(--foreground));
  }

  main[data-mobile-operational-route] [data-mobile-table-tools] button {
    border: 1px solid hsl(var(--border));
    border-radius: 0.375rem;
    padding-inline: 0.75rem;
    color: hsl(var(--foreground));
  }

  main[data-mobile-operational-route] [data-mobile-table-status] {
    flex: 0 0 100%;
    color: hsl(var(--muted-foreground));
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.6875rem;
  }

  main[data-mobile-operational-route] {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
    scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom));
  }

  main[data-mobile-operational-route] button,
  main[data-mobile-operational-route] a[role="button"],
  main[data-mobile-operational-route] input,
  main[data-mobile-operational-route] select,
  main[data-mobile-operational-route] textarea,
  body[data-mobile-operational-active] [role="dialog"] button,
  body[data-mobile-operational-active] [role="dialog"] input,
  body[data-mobile-operational-active] [role="dialog"] select,
  body[data-mobile-operational-active] [role="dialog"] textarea {
    min-height: 44px;
  }

  main[data-mobile-operational-route] input,
  main[data-mobile-operational-route] select,
  main[data-mobile-operational-route] textarea,
  body[data-mobile-operational-active] [role="dialog"] input,
  body[data-mobile-operational-active] [role="dialog"] select,
  body[data-mobile-operational-active] [role="dialog"] textarea {
    font-size: 16px;
  }

  main[data-mobile-operational-route] [role="tablist"] {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) {
    display: block;
    width: 100%;
    min-width: 0;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > thead {
    display: none;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody {
    display: grid;
    gap: 0.5rem;
    width: 100%;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    overflow: hidden;
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--background));
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr > td {
    display: flex;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid hsl(var(--border) / 0.65);
    padding: 0.625rem 0.875rem !important;
    text-align: right !important;
    white-space: normal !important;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr > td:last-child {
    border-bottom: 0;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr > td::before {
    content: attr(data-mobile-label);
    flex: 0 0 min(42%, 10rem);
    overflow: hidden;
    color: hsl(var(--muted-foreground));
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    line-height: 1.25;
    text-align: left;
    text-overflow: ellipsis;
    text-transform: uppercase;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr > td[data-mobile-label=""]::before {
    display: none;
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tfoot {
    display: block;
    margin-top: 0.5rem;
    border-top: 1px solid hsl(var(--border));
  }

  body[data-mobile-operational-active] [role="dialog"] {
    max-width: 100vw !important;
    max-height: calc(100dvh - env(safe-area-inset-top)) !important;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
    scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom));
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  main[data-mobile-operational-route] table[data-mobile-card-table]:not([data-mobile-desktop-only]) > tbody > tr > td:nth-last-child(1):nth-child(odd) {
    grid-column: 1 / -1;
  }
}
`;

const MOBILE_TABLE_PAGE_SIZE = 25;
const tableCleanup = new Map<HTMLTableElement, () => void>();

function enhanceOperationalTable(table: HTMLTableElement): void {
  if (table.closest("[data-desktop-table]")) {
    table.dataset.mobileDesktopOnly = "true";
    return;
  }

  table.dataset.mobileCardTable = "true";
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map((header) =>
    (header.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
    Array.from(row.cells).forEach((cell, index) => {
      cell.dataset.mobileLabel = headers[index] ?? "";
    });
  }

  if (tableCleanup.has(table)) {
    table.dispatchEvent(new CustomEvent("mobile-table-refresh"));
    return;
  }

  const tools = document.createElement("div");
  tools.dataset.mobileTableTools = "true";
  tools.setAttribute("aria-label", "Mobile table controls");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search records…";
  search.setAttribute("aria-label", "Search table records");
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  const status = document.createElement("span");
  status.dataset.mobileTableStatus = "true";
  status.setAttribute("aria-live", "polite");
  tools.append(search, previous, next, status);
  table.before(tools);

  let page = 1;
  const mobileQuery = window.matchMedia("(max-width: 1023px)");
  const update = () => {
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
    tools.hidden = !mobileQuery.matches;
    if (!mobileQuery.matches) {
      for (const row of rows) row.hidden = false;
      return;
    }
    const term = search.value.trim().toLocaleLowerCase();
    const matches = rows.filter((row) => !term || (row.textContent ?? "").toLocaleLowerCase().includes(term));
    const pageCount = Math.max(1, Math.ceil(matches.length / MOBILE_TABLE_PAGE_SIZE));
    page = Math.min(page, pageCount);
    const visible = new Set(matches.slice((page - 1) * MOBILE_TABLE_PAGE_SIZE, page * MOBILE_TABLE_PAGE_SIZE));
    for (const row of rows) row.hidden = !visible.has(row);
    previous.disabled = page <= 1;
    next.disabled = page >= pageCount;
    status.textContent = matches.length === 0
      ? "No matching records. Clear the search to restore the list."
      : `${matches.length} record${matches.length === 1 ? "" : "s"} · page ${page} of ${pageCount}`;
  };
  const onSearch = () => { page = 1; update(); };
  const onPrevious = () => { page = Math.max(1, page - 1); update(); };
  const onNext = () => { page += 1; update(); };
  search.addEventListener("input", onSearch);
  previous.addEventListener("click", onPrevious);
  next.addEventListener("click", onNext);
  table.addEventListener("mobile-table-refresh", update);
  mobileQuery.addEventListener("change", update);
  update();

  tableCleanup.set(table, () => {
    search.removeEventListener("input", onSearch);
    previous.removeEventListener("click", onPrevious);
    next.removeEventListener("click", onNext);
    table.removeEventListener("mobile-table-refresh", update);
    mobileQuery.removeEventListener("change", update);
    tools.remove();
    for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) row.hidden = false;
  });
}

function labelOperationalTables(root: HTMLElement): void {
  for (const table of root.querySelectorAll<HTMLTableElement>("table")) enhanceOperationalTable(table);
}

export function RouteContextBar({ branchName, online }: RouteContextBarProps) {
  return (
    <div
      aria-label="Route context"
      data-mobile-route-context
      className="flex min-h-11 items-center gap-2 border-y border-foreground/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:px-6 lg:hidden"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{branchName}</span>
      </span>
      <span aria-hidden className="text-foreground/20">/</span>
      <span
        className={`ml-auto inline-flex shrink-0 items-center gap-1.5 ${
          online ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {online ? <CloudCheck className="size-3.5" aria-hidden /> : <CloudSlash className="size-3.5" aria-hidden />}
        {online ? "Online" : "Offline · local mode"}
      </span>
    </div>
  );
}

export function MobileRouteContext() {
  const markerRef = useRef<HTMLDivElement>(null);
  const branchName = useActiveBranch((state) => state.active?.name ?? "Main Branch");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [isPrimaryContext, setIsPrimaryContext] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const routeRoot = markerRef.current?.closest<HTMLElement>("main") ?? markerRef.current?.parentElement;
    if (!routeRoot) return;

    const primaryMarker = routeRoot.querySelector<HTMLElement>("[data-mobile-route-marker]");
    const primary = primaryMarker === markerRef.current;
    setIsPrimaryContext(primary);
    if (!primary) return;

    routeRoot.dataset.mobileOperationalRoute = "true";
    document.body.dataset.mobileOperationalActive = "true";
    labelOperationalTables(routeRoot);

    const observer = new MutationObserver(() => labelOperationalTables(routeRoot));
    observer.observe(routeRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      delete routeRoot.dataset.mobileOperationalRoute;
      delete document.body.dataset.mobileOperationalActive;
      for (const table of routeRoot.querySelectorAll<HTMLTableElement>("table")) {
        tableCleanup.get(table)?.();
        tableCleanup.delete(table);
        delete table.dataset.mobileCardTable;
        delete table.dataset.mobileDesktopOnly;
        for (const cell of table.querySelectorAll<HTMLTableCellElement>("td")) delete cell.dataset.mobileLabel;
      }
    };
  }, []);

  return (
    <div ref={markerRef} data-mobile-route-marker className="contents">
      {isPrimaryContext && (
        <>
          <style>{MOBILE_OPERATIONAL_STYLES}</style>
          <RouteContextBar branchName={branchName} online={online} />
        </>
      )}
    </div>
  );
}

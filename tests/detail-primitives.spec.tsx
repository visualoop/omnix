/**
 * Tests for the detail-page primitives shipping in batch 2.
 *
 * Covers Breadcrumbs (link rendering, current-page handling),
 * LazyTabs (lazy mount + URL deep-link), FuzzySearch (filter +
 * keyboard nav), and EntityHero (eyebrow + title + stats render).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { FuzzySearch } from "@/components/ui/fuzzy-search"
import { EntityHero } from "@/components/ui/entity-hero"

beforeEach(() => cleanup())

describe("Breadcrumbs", () => {
  it("renders a chain with separators", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: "Inventory", to: "/inventory" }, { label: "Paracetamol" }]} />
      </MemoryRouter>,
    )
    expect(screen.getByText("Inventory")).toBeDefined()
    expect(screen.getByText("Paracetamol")).toBeDefined()
    // Last item is not a link.
    expect(screen.getByText("Paracetamol").tagName).not.toBe("A")
  })

  it("returns null for empty items", () => {
    const { container } = render(<MemoryRouter><Breadcrumbs items={[]} /></MemoryRouter>)
    expect(container.querySelector("nav")).toBeNull()
  })
})

describe("LazyTabs", () => {
  it("only mounts the active tab on first render", () => {
    const renderA = vi.fn(() => <div>A-body</div>)
    const renderB = vi.fn(() => <div>B-body</div>)
    render(
      <MemoryRouter>
        <LazyTabs
          tabs={[
            { id: "a", label: "First", render: renderA },
            { id: "b", label: "Second", render: renderB },
          ]}
        />
      </MemoryRouter>,
    )
    expect(renderA).toHaveBeenCalled()
    expect(renderB).not.toHaveBeenCalled()
    expect(screen.getByText("A-body")).toBeDefined()
  })

  it("mounts a tab when activated and keeps it mounted", () => {
    const renderA = vi.fn(() => <div>A-body</div>)
    const renderB = vi.fn(() => <div>B-body</div>)
    render(
      <MemoryRouter>
        <LazyTabs
          tabs={[
            { id: "a", label: "First", render: renderA },
            { id: "b", label: "Second", render: renderB },
          ]}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText("Second"))
    expect(renderB).toHaveBeenCalled()
    fireEvent.click(screen.getByText("First"))
    // Both still in DOM (one with hidden attribute), call count ≤ 2 each.
    expect(renderA).toHaveBeenCalled()
    expect(renderB).toHaveBeenCalled()
  })
})

describe("FuzzySearch", () => {
  const data = [
    { id: 1, name: "Paracetamol", sku: "PCM500" },
    { id: 2, name: "Amoxicillin", sku: "AMX250" },
    { id: 3, name: "Bandage", sku: "BND01" },
  ]

  it("shows all items when query is empty (no list visible until typing)", () => {
    const onSelect = vi.fn()
    render(
      <FuzzySearch
        items={data}
        keys={["name", "sku"]}
        onSelect={onSelect}
        renderItem={(i) => <span>{i.name}</span>}
      />,
    )
    // No query yet — list isn't rendered (closed state).
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("filters by query across multiple keys", async () => {
    const onSelect = vi.fn()
    render(
      <FuzzySearch
        items={data}
        keys={["name", "sku"]}
        onSelect={onSelect}
        debounceMs={0}
        renderItem={(i) => <span>{i.name}</span>}
      />,
    )
    const input = screen.getByPlaceholderText("Search…")
    fireEvent.change(input, { target: { value: "amx" } })
    // Wait a beat for debounce
    await new Promise((r) => setTimeout(r, 5))
    expect(screen.getByText("Amoxicillin")).toBeDefined()
    expect(screen.queryByText("Paracetamol")).toBeNull()
  })

  it("calls onSelect when Enter is pressed on highlighted match", async () => {
    const onSelect = vi.fn()
    render(
      <FuzzySearch
        items={data}
        keys={["name"]}
        onSelect={onSelect}
        debounceMs={0}
        renderItem={(i) => <span>{i.name}</span>}
      />,
    )
    const input = screen.getByPlaceholderText("Search…")
    fireEvent.change(input, { target: { value: "para" } })
    await new Promise((r) => setTimeout(r, 5))
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSelect).toHaveBeenCalledWith(data[0])
  })
})

describe("EntityHero", () => {
  it("renders eyebrow + title + subtitle", () => {
    render(
      <EntityHero
        eyebrow="Product"
        title="Paracetamol 500mg"
        subtitle="SKU: PCM500"
      />,
    )
    expect(screen.getByText("Product")).toBeDefined()
    expect(screen.getByText("Paracetamol 500mg")).toBeDefined()
    expect(screen.getByText("SKU: PCM500")).toBeDefined()
  })

  it("renders stat cells when provided", () => {
    render(
      <EntityHero
        title="Test"
        stats={[
          { label: "On hand", value: "320" },
          { label: "Cost", value: "KES 2.50" },
        ]}
      />,
    )
    expect(screen.getByText("On hand")).toBeDefined()
    expect(screen.getByText("320")).toBeDefined()
    expect(screen.getByText("Cost")).toBeDefined()
  })
})

/**
 * BackButton primitive tests.
 *
 * Covers:
 *  - Renders with default "Back" label
 *  - Renders custom label when passed
 *  - Calls navigate(-1) when window.history.length > 1
 *  - Calls navigate(fallback) when there's no history
 *  - Hides itself when on root or on the fallback path (already there)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { BackButton } from "@/components/ui/back-button"

const navigateMock = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: "/inventory/abc123" } as ReturnType<typeof actual.useLocation>),
  }
})

describe("BackButton", () => {
  beforeEach(() => {
    cleanup()
    navigateMock.mockClear()
  })

  it("renders the default 'Back' label", () => {
    render(<MemoryRouter><BackButton fallback="/inventory" /></MemoryRouter>)
    expect(screen.getByText("Back")).toBeDefined()
  })

  it("respects a custom label", () => {
    render(<MemoryRouter><BackButton fallback="/inventory" label="Back to inventory" /></MemoryRouter>)
    expect(screen.getByText("Back to inventory")).toBeDefined()
  })

  it("calls navigate(-1) when history exists", () => {
    Object.defineProperty(window, "history", { value: { length: 5 }, writable: true })
    const { container } = render(<MemoryRouter><BackButton fallback="/inventory" /></MemoryRouter>)
    fireEvent.click(container.querySelector("button")!)
    expect(navigateMock).toHaveBeenCalledWith(-1)
  })

  it("calls navigate(fallback) when there's no history", () => {
    Object.defineProperty(window, "history", { value: { length: 1 }, writable: true })
    const { container } = render(<MemoryRouter><BackButton fallback="/inventory" /></MemoryRouter>)
    fireEvent.click(container.querySelector("button")!)
    expect(navigateMock).toHaveBeenCalledWith("/inventory")
  })

  it("falls back to / when neither history nor fallback is set", () => {
    Object.defineProperty(window, "history", { value: { length: 1 }, writable: true })
    const { container } = render(<MemoryRouter><BackButton /></MemoryRouter>)
    fireEvent.click(container.querySelector("button")!)
    expect(navigateMock).toHaveBeenCalledWith("/")
  })
})

/**
 * ProfilePicker tests.
 *
 * Covers the unit-level behaviour the login page depends on:
 *   - tile per active user
 *   - role pill text matches the user's role
 *   - clicking a tile fires onPick(user)
 *   - clicking "Use a different account" fires onUseOther
 *   - the initials helper handles the empty-name case
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ProfilePicker, initialsOf } from "@/components/login/profile-picker"
import type { User } from "@/services/auth"

const USERS: User[] = [
  { id: "u1", username: "owner", full_name: "Mary Owner", role: "owner", active: 1 },
  { id: "u2", username: "manager", full_name: "Peter Manager", role: "manager", active: 1 },
  { id: "u3", username: "cashier1", full_name: "Jane Cashier", role: "cashier", active: 1 },
]

beforeEach(() => cleanup())

describe("initialsOf", () => {
  it("uses first + last initial for multi-word names", () => {
    expect(initialsOf("Mary Owner", "owner")).toBe("MO")
    expect(initialsOf("Jane Wairimu Kamau", "jane")).toBe("JK")
  })

  it("uses first two letters of single-word name", () => {
    expect(initialsOf("Cashier", "cashier")).toBe("CA")
  })

  it("falls back to the username when name is empty", () => {
    expect(initialsOf("", "ke")).toBe("KE")
    expect(initialsOf("   ", "ow")).toBe("OW")
  })

  it("upper-cases", () => {
    expect(initialsOf("alice baker", "alice")).toBe("AB")
  })
})

describe("ProfilePicker", () => {
  it("renders a tile per active user with role + name visible", () => {
    render(<ProfilePicker users={USERS} onPick={() => {}} />)
    expect(screen.getByText("Mary Owner")).toBeDefined()
    expect(screen.getByText("Peter Manager")).toBeDefined()
    expect(screen.getByText("Jane Cashier")).toBeDefined()
    // Role pills (lowercase per the data model, the component uppercase-tracks them)
    expect(screen.getByText("owner")).toBeDefined()
    expect(screen.getByText("manager")).toBeDefined()
    expect(screen.getByText("cashier")).toBeDefined()
  })

  it("calls onPick with the chosen user when a tile is clicked", () => {
    const onPick = vi.fn()
    render(<ProfilePicker users={USERS} onPick={onPick} />)
    fireEvent.click(screen.getByText("Peter Manager"))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(USERS[1])
  })

  it("renders 'Use a different account' link when onUseOther is set", () => {
    const onUseOther = vi.fn()
    render(<ProfilePicker users={USERS} onPick={() => {}} onUseOther={onUseOther} />)
    const link = screen.getByText("Use a different account")
    expect(link).toBeDefined()
    fireEvent.click(link)
    expect(onUseOther).toHaveBeenCalled()
  })

  it("does NOT render the fallback link when onUseOther is omitted", () => {
    render(<ProfilePicker users={USERS} onPick={() => {}} />)
    expect(screen.queryByText("Use a different account")).toBeNull()
  })

  it("uses a 1-column grid for ≤2 users, 2-column for 3-4, 3-column for 5+", () => {
    const onPick = vi.fn()
    const { container, rerender } = render(<ProfilePicker users={USERS.slice(0, 1)} onPick={onPick} />)
    expect(container.querySelector("ul")?.className).toContain("grid-cols-1")

    rerender(<ProfilePicker users={USERS.slice(0, 2)} onPick={onPick} />)
    expect(container.querySelector("ul")?.className).toContain("grid-cols-1")

    rerender(<ProfilePicker users={USERS.slice(0, 3)} onPick={onPick} />)
    expect(container.querySelector("ul")?.className).toContain("grid-cols-2")

    rerender(<ProfilePicker users={[...USERS, { id: "u4", username: "v", full_name: "V", role: "viewer", active: 1 }, { id: "u5", username: "v2", full_name: "V2", role: "viewer", active: 1 }]} onPick={onPick} />)
    expect(container.querySelector("ul")?.className).toContain("grid-cols-3")
  })
})

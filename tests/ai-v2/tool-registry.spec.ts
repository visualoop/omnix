/**
 * ai/v2 — tool registry contract tests.
 *
 * These cover:
 *   • Register + retrieve
 *   • Duplicate registration throws
 *   • Permission-filtered `toolsForAgent`
 *   • Allowlist narrowing
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { defineTool } from "@/services/ai/v2/tools/base";
import {
  register,
  getTool,
  listTools,
  toolsForAgent,
  _resetRegistry,
} from "@/services/ai/v2/tools/registry";

const read = defineTool({
  id: "test.read",
  description: "read tool",
  parameters: z.object({ q: z.string() }),
  tier: "read" as const,
  ui: { label: "Test read" },
  async execute() {
    return { title: "ok", output: "read done", metadata: {} };
  },
});
const write = defineTool({
  id: "test.write",
  description: "write tool",
  parameters: z.object({ name: z.string() }),
  tier: "write" as const,
  ui: { label: "Test write" },
  async execute() {
    return { title: "ok", output: "wrote", metadata: {} };
  },
});
const destructive = defineTool({
  id: "test.void",
  description: "void tool",
  parameters: z.object({ id: z.string() }),
  tier: "destructive" as const,
  ui: { label: "Test void" },
  async execute() {
    return { title: "ok", output: "voided", metadata: {} };
  },
});

describe("ai/v2/tools/registry", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it("registers and retrieves tools", () => {
    register(read);
    register(write);
    expect(getTool("test.read")).toBe(read);
    expect(getTool("test.write")).toBe(write);
    expect(listTools()).toHaveLength(2);
  });

  it("throws on duplicate registration", () => {
    register(read);
    expect(() => register(read)).toThrow(/already registered/);
  });

  it("returns null for unknown ids", () => {
    expect(getTool("does.not.exist")).toBeNull();
  });

  it("toolsForAgent with allow-everything gives every tool", () => {
    register(read); register(write); register(destructive);
    const rules = [
      { tier: "read" as const,        action: "allow" as const },
      { tier: "write" as const,       action: "ask" as const },
      { tier: "destructive" as const, action: "ask" as const },
    ];
    expect(toolsForAgent(rules).map((t) => t.id).sort()).toEqual([
      "test.read", "test.void", "test.write",
    ]);
  });

  it("toolsForAgent excludes tiers with action=deny", () => {
    register(read); register(write); register(destructive);
    const rules = [
      { tier: "read" as const,        action: "allow" as const },
      { tier: "write" as const,       action: "deny" as const },
      { tier: "destructive" as const, action: "deny" as const },
    ];
    expect(toolsForAgent(rules).map((t) => t.id)).toEqual(["test.read"]);
  });

  it("toolsForAgent honours per-tool deny even when tier is allowed", () => {
    register(read); register(write);
    const rules = [
      { tier: "read" as const,  action: "allow" as const },
      { tier: "write" as const, action: "ask" as const },
      { tier: "write" as const, toolId: "test.write", action: "deny" as const },
    ];
    expect(toolsForAgent(rules).map((t) => t.id)).toEqual(["test.read"]);
  });

  it("allowlist narrows to given ids only", () => {
    register(read); register(write); register(destructive);
    const rules = [
      { tier: "read" as const,        action: "allow" as const },
      { tier: "write" as const,       action: "ask" as const },
      { tier: "destructive" as const, action: "ask" as const },
    ];
    expect(toolsForAgent(rules, ["test.read"]).map((t) => t.id)).toEqual(["test.read"]);
  });
});

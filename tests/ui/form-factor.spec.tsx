import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyFormFactor,
  useDeviceCapabilities,
  useFormFactor,
} from "@/hooks/use-form-factor";

interface MediaState {
  coarse: boolean;
  hover: boolean;
  fine: boolean;
  reducedMotion: boolean;
}

let mediaState: MediaState;
const listeners = new Map<string, Set<() => void>>();

function matches(query: string): boolean {
  if (query === "(pointer: coarse)") return mediaState.coarse;
  if (query === "(hover: hover)") return mediaState.hover;
  if (query === "(pointer: fine)") return mediaState.fine;
  if (query === "(prefers-reduced-motion: reduce)") return mediaState.reducedMotion;
  return false;
}

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function Harness() {
  const factor = useFormFactor();
  const capabilities = useDeviceCapabilities();
  return (
    <output>
      <span data-testid="factor">{factor}</span>
      <span data-testid="capabilities">
        {JSON.stringify(capabilities)}
      </span>
    </output>
  );
}

beforeEach(() => {
  mediaState = { coarse: false, hover: true, fine: true, reducedMotion: false };
  listeners.clear();
  setViewport(1280);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: () => void) => {
      const current = listeners.get(query) ?? new Set();
      current.add(listener);
      listeners.set(query, current);
    },
    removeEventListener: (_event: string, listener: () => void) => listeners.get(query)?.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("classifyFormFactor", () => {
  it.each([
    [320, "phone"],
    [639, "phone"],
    [640, "tablet"],
    [1023, "tablet"],
    [1024, "desktop"],
  ] as const)("classifies %ipx as %s", (width, expected) => {
    expect(classifyFormFactor(width)).toBe(expected);
  });
});

describe("form-factor capabilities", () => {
  it("reacts when the viewport crosses form-factor boundaries", () => {
    setViewport(390, 844);
    render(<Harness />);
    expect(screen.getByTestId("factor").textContent).toBe("phone");

    act(() => {
      setViewport(800, 1024);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("factor").textContent).toBe("tablet");
  });

  it("keeps touch, hover, pointer precision, and reduced motion separate from width", () => {
    setViewport(1366, 768);
    mediaState = { coarse: true, hover: false, fine: false, reducedMotion: true };
    render(<Harness />);

    const capabilities = JSON.parse(screen.getByTestId("capabilities").textContent ?? "{}") as Record<string, unknown>;
    expect(capabilities).toMatchObject({
      formFactor: "desktop",
      hasTouch: true,
      hasHover: false,
      hasFinePointer: false,
      prefersReducedMotion: true,
      viewportWidth: 1366,
      viewportHeight: 768,
    });
  });

  it("reacts to capability changes without changing the form factor", () => {
    setViewport(1280, 800);
    render(<Harness />);

    act(() => {
      mediaState = { coarse: true, hover: false, fine: false, reducedMotion: true };
      for (const callbacks of listeners.values()) {
        for (const callback of callbacks) callback();
      }
    });

    const capabilities = JSON.parse(screen.getByTestId("capabilities").textContent ?? "{}") as Record<string, unknown>;
    expect(capabilities).toMatchObject({
      formFactor: "desktop",
      hasTouch: true,
      hasHover: false,
      hasFinePointer: false,
      prefersReducedMotion: true,
    });
  });
});

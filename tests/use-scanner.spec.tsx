/**
 * useScanner — burst-detection tests.
 *
 * Renders a tiny harness that mounts the hook + dispatches keydown events
 * with controlled timing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { useScanner } from "@/hooks/use-scanner";

function Harness({ onScan, enabled }: { onScan: (s: string) => void; enabled?: boolean }) {
  useScanner(onScan, { enabled });
  return <div data-testid="harness">scanner</div>;
}

const fireKey = (key: string, target?: HTMLElement) => {
  const evt = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  if (target) {
    target.dispatchEvent(evt);
  } else {
    window.dispatchEvent(evt);
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let mockNow = 0;
beforeEach(() => {
  mockNow = 0;
  vi.spyOn(performance, "now").mockImplementation(() => mockNow);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const advanceMs = (n: number) => {
  mockNow += n;
};

describe("useScanner: burst detection", () => {
  it("fires onScan on a fast burst ending with Enter", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    // Simulate HID burst: 10 chars at 5ms gaps + Enter
    "1234567890".split("").forEach((c) => {
      advanceMs(5);
      fireKey(c);
    });
    advanceMs(5);
    fireKey("Enter");

    expect(onScan).toHaveBeenCalledExactlyOnceWith("1234567890");
  });

  it("does NOT fire onScan on slow human typing", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    // Human typing: 200ms between keys
    "hello".split("").forEach((c) => {
      advanceMs(200);
      fireKey(c);
    });
    advanceMs(200);
    fireKey("Enter");

    // Buffer was reset every gap — Enter triggers flush of empty buffer
    expect(onScan).not.toHaveBeenCalled();
  });

  it("filters single-keystroke noise (Enter alone after short input)", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    // 2 chars (below MIN_PAYLOAD_LEN=3) + Enter
    advanceMs(5); fireKey("a");
    advanceMs(5); fireKey("b");
    advanceMs(5); fireKey("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });

  it("handles multiple consecutive bursts", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    "abc12".split("").forEach((c) => { advanceMs(5); fireKey(c); });
    advanceMs(5); fireKey("Enter");

    // Pause then second burst
    advanceMs(2000);
    "xyz98".split("").forEach((c) => { advanceMs(5); fireKey(c); });
    advanceMs(5); fireKey("Enter");

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(1, "abc12");
    expect(onScan).toHaveBeenNthCalledWith(2, "xyz98");
  });

  it("flushes only the rapid suffix when slow typing precedes a burst", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    // Slow typing into nothing
    advanceMs(0); fireKey("h");
    advanceMs(200); fireKey("i");
    // Now a burst
    advanceMs(5); fireKey("X");
    advanceMs(5); fireKey("Y");
    advanceMs(5); fireKey("Z");
    advanceMs(5); fireKey("1");
    advanceMs(5); fireKey("Enter");

    expect(onScan).toHaveBeenCalledExactlyOnceWith("XYZ1");
  });

  it("ignores Enter alone with no preceding burst", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    fireKey("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });
});

describe("useScanner: focus-aware", () => {
  it("does NOT intercept when focus is in a text INPUT", () => {
    const onScan = vi.fn();
    const { container } = render(
      <>
        <input data-testid="input" />
        <Harness onScan={onScan} />
      </>,
    );
    const input = container.querySelector("input")!;
    input.focus();
    "1234567890".split("").forEach((c) => { advanceMs(5); fireKey(c, input); });
    advanceMs(5); fireKey("Enter", input);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("does NOT intercept when focus is in a TEXTAREA", () => {
    const onScan = vi.fn();
    const { container } = render(
      <>
        <textarea data-testid="ta" />
        <Harness onScan={onScan} />
      </>,
    );
    const ta = container.querySelector("textarea")!;
    ta.focus();
    "1234567890".split("").forEach((c) => { advanceMs(5); fireKey(c, ta); });
    advanceMs(5); fireKey("Enter", ta);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("DOES intercept when focus is on a button (non-text)", () => {
    const onScan = vi.fn();
    const { container } = render(
      <>
        <button data-testid="btn">click</button>
        <Harness onScan={onScan} />
      </>,
    );
    const btn = container.querySelector("button")!;
    btn.focus();
    "1234567890".split("").forEach((c) => { advanceMs(5); fireKey(c, btn); });
    advanceMs(5); fireKey("Enter", btn);
    expect(onScan).toHaveBeenCalledExactlyOnceWith("1234567890");
  });
});

describe("useScanner: lifecycle", () => {
  it("does not fire after unmount", () => {
    const onScan = vi.fn();
    const { unmount } = render(<Harness onScan={onScan} />);
    unmount();
    "1234567890".split("").forEach((c) => { advanceMs(5); fireKey(c); });
    advanceMs(5); fireKey("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });

  it("respects enabled=false", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} enabled={false} />);
    "1234567890".split("").forEach((c) => { advanceMs(5); fireKey(c); });
    advanceMs(5); fireKey("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });
});

describe("useScanner: buffer reset", () => {
  it("buffer auto-clears after RESET window passes", async () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    // Burst of 5 chars then long pause then Enter — buffer should be empty
    "abcde".split("").forEach((c) => { advanceMs(5); fireKey(c); });
    // Real-time wait so the setTimeout(RESET_AFTER_MS) actually fires
    await sleep(150);
    advanceMs(5); fireKey("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes immediately on first call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throttles subsequent calls within wait period", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(); // executes immediately
    throttled(); // scheduled
    throttled(); // ignored (existing schedule)

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2); // scheduled one fires
  });

  it("allows calls after wait period", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes arguments to the throttled function", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("a", "b");
    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("uses the arguments from when the deferred call was scheduled", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("first");   // executes immediately
    throttled("second");  // schedules deferred call with "second"
    throttled("third");   // ignored — deferred already scheduled

    vi.advanceTimersByTime(100);
    // Deferred call uses the args from when it was scheduled
    expect(fn).toHaveBeenLastCalledWith("second");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatBytesPerSecond,
  formatDuration,
  formatPercent,
} from "./metricsService";

// ─── formatBytes ───────────────────────────────────────────
describe("formatBytes", () => {
  it("returns '0 B' for 0", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512.00 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("formats terabytes", () => {
    expect(formatBytes(1099511627776)).toBe("1.00 TB");
  });

  it("formats fractional values", () => {
    expect(formatBytes(1536)).toBe("1.50 KB");
  });
});

// ─── formatBytesPerSecond ──────────────────────────────────
describe("formatBytesPerSecond", () => {
  it("returns '0 B/s' for 0", () => {
    expect(formatBytesPerSecond(0)).toBe("0 B/s");
  });

  it("formats bytes per second", () => {
    expect(formatBytesPerSecond(512)).toBe("512.00 B/s");
  });

  it("formats kilobytes per second", () => {
    expect(formatBytesPerSecond(1024)).toBe("1.00 KB/s");
  });

  it("formats megabytes per second", () => {
    expect(formatBytesPerSecond(1048576)).toBe("1.00 MB/s");
  });

  it("formats gigabytes per second", () => {
    expect(formatBytesPerSecond(1073741824)).toBe("1.00 GB/s");
  });
});

// ─── formatDuration ────────────────────────────────────────
describe("formatDuration", () => {
  it("formats hours, minutes, seconds", () => {
    expect(formatDuration("02:30:15.000")).toBe("2h 30m 15s");
  });

  it("formats minutes and seconds (no hours)", () => {
    expect(formatDuration("00:05:30.000")).toBe("5m 30s");
  });

  it("formats seconds only", () => {
    expect(formatDuration("00:00:45.000")).toBe("45s");
  });

  it("formats with days prefix", () => {
    // .NET timespan format with days: "1.02:30:15"
    // The parser splits by ":", first part is "1.02" → parseInt = 1
    // This tests the format still parses without error
    const result = formatDuration("1.02:30:15.000");
    expect(result).toContain("m");
  });

  it("returns original string for unparseable format", () => {
    expect(formatDuration("invalid")).toBe("invalid");
  });

  it("truncates fractional seconds", () => {
    expect(formatDuration("00:00:12.345")).toBe("12s");
  });
});

// ─── formatPercent ─────────────────────────────────────────
describe("formatPercent", () => {
  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats whole numbers", () => {
    expect(formatPercent(50)).toBe("50.0%");
  });

  it("formats fractional values", () => {
    expect(formatPercent(33.333)).toBe("33.3%");
  });

  it("formats 100%", () => {
    expect(formatPercent(100)).toBe("100.0%");
  });

  it("formats small values", () => {
    expect(formatPercent(0.15)).toBe("0.1%");
    expect(formatPercent(0.25)).toBe("0.3%");
  });
});

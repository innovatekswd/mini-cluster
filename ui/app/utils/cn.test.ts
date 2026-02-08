import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles a single class", () => {
    expect(cn("p-4")).toBe("p-4");
  });

  it("merges multiple classes", () => {
    expect(cn("p-4", "m-2")).toBe("p-4 m-2");
  });

  it("handles conditional classes", () => {
    expect(cn("p-4", false && "hidden", "m-2")).toBe("p-4 m-2");
    expect(cn("p-4", true && "hidden", "m-2")).toBe("p-4 hidden m-2");
  });

  it("handles undefined and null", () => {
    expect(cn("p-4", undefined, null, "m-2")).toBe("p-4 m-2");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("merges conflicting responsive variants", () => {
    expect(cn("md:p-4", "md:p-2")).toBe("md:p-2");
  });

  it("handles array input", () => {
    expect(cn(["p-4", "m-2"])).toBe("p-4 m-2");
  });

  it("handles objects (clsx style)", () => {
    expect(cn({ "p-4": true, hidden: false, "m-2": true })).toBe("p-4 m-2");
  });

  it("handles mix of strings, arrays, and objects", () => {
    expect(cn("text-sm", ["p-4"], { hidden: true })).toBe("text-sm p-4 hidden");
  });
});

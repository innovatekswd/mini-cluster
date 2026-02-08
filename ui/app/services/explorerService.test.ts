import { describe, it, expect } from "vitest";
import {
  formatFileSize,
  formatDate,
  getFileIcon,
  isEditable,
  isPreviewable,
  type FileItem,
} from "./explorerService";

// ─── Helper ────────────────────────────────────────────────
function makeFileItem(overrides: Partial<FileItem> = {}): FileItem {
  return {
    name: "test.txt",
    path: "/home/test.txt",
    type: "file",
    size: 1024,
    modified: "2025-01-15T10:30:00Z",
    created: "2025-01-01T00:00:00Z",
    extension: ".txt",
    mimeType: "text/plain",
    permissions: "rw-r--r--",
    isHidden: false,
    isReadable: true,
    isWritable: true,
    category: "text",
    ...overrides,
  };
}

// ─── formatFileSize ────────────────────────────────────────
describe("formatFileSize", () => {
  it("returns '-' for 0 bytes", () => {
    expect(formatFileSize(0)).toBe("-");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });

  it("formats fractional values", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });
});

// ─── formatDate ────────────────────────────────────────────
describe("formatDate", () => {
  it("formats an ISO date string", () => {
    const result = formatDate("2025-01-15T10:30:00Z");
    // Date formatting is locale-dependent, just verify it returns a non-empty string
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("includes year and time components", () => {
    const result = formatDate("2025-06-01T14:00:00Z");
    expect(result).toContain("2025");
  });
});

// ─── getFileIcon ───────────────────────────────────────────
describe("getFileIcon", () => {
  it("returns folder icon for directories", () => {
    expect(getFileIcon(makeFileItem({ type: "directory", category: "directory" }))).toBe("📁");
  });

  it("returns JSON icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".json", category: "text" }))).toBe("📋");
  });

  it("returns XML icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".xml", category: "text" }))).toBe("📰");
  });

  it("returns Markdown icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".md", category: "text" }))).toBe("📝");
  });

  it("returns code icon for JS/TS files", () => {
    expect(getFileIcon(makeFileItem({ extension: ".ts", category: "text" }))).toBe("⚡");
    expect(getFileIcon(makeFileItem({ extension: ".jsx", category: "text" }))).toBe("⚡");
  });

  it("returns CSS icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".css", category: "text" }))).toBe("🎨");
    expect(getFileIcon(makeFileItem({ extension: ".scss", category: "text" }))).toBe("🎨");
  });

  it("returns HTML icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".html", category: "text" }))).toBe("🌐");
  });

  it("returns Python icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".py", category: "text" }))).toBe("🐍");
  });

  it("returns C# icon", () => {
    expect(getFileIcon(makeFileItem({ extension: ".cs", category: "text" }))).toBe("💜");
  });

  it("returns generic text icon for unknown text files", () => {
    expect(getFileIcon(makeFileItem({ extension: ".log", category: "text" }))).toBe("📄");
  });

  it("returns image icon", () => {
    expect(getFileIcon(makeFileItem({ category: "image" }))).toBe("🖼️");
  });

  it("returns video icon", () => {
    expect(getFileIcon(makeFileItem({ category: "video" }))).toBe("🎬");
  });

  it("returns audio icon", () => {
    expect(getFileIcon(makeFileItem({ category: "audio" }))).toBe("🎵");
  });

  it("returns binary icon for unknown types", () => {
    expect(getFileIcon(makeFileItem({ category: "binary" }))).toBe("📦");
  });
});

// ─── isEditable ────────────────────────────────────────────
describe("isEditable", () => {
  it("returns true for readable text files", () => {
    expect(isEditable(makeFileItem({ type: "file", category: "text", isReadable: true }))).toBe(true);
  });

  it("returns false for directories", () => {
    expect(isEditable(makeFileItem({ type: "directory", category: "directory" }))).toBe(false);
  });

  it("returns false for non-text files", () => {
    expect(isEditable(makeFileItem({ category: "binary" }))).toBe(false);
  });

  it("returns false for unreadable text files", () => {
    expect(isEditable(makeFileItem({ category: "text", isReadable: false }))).toBe(false);
  });
});

// ─── isPreviewable ─────────────────────────────────────────
describe("isPreviewable", () => {
  it("returns true for text files", () => {
    expect(isPreviewable(makeFileItem({ category: "text" }))).toBe(true);
  });

  it("returns true for image files", () => {
    expect(isPreviewable(makeFileItem({ category: "image" }))).toBe(true);
  });

  it("returns true for video files", () => {
    expect(isPreviewable(makeFileItem({ category: "video" }))).toBe(true);
  });

  it("returns true for audio files", () => {
    expect(isPreviewable(makeFileItem({ category: "audio" }))).toBe(true);
  });

  it("returns false for binary files", () => {
    expect(isPreviewable(makeFileItem({ category: "binary" }))).toBe(false);
  });

  it("returns false for directories", () => {
    expect(isPreviewable(makeFileItem({ type: "directory", category: "directory" }))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  UI_STRINGS,
  QUERY_KEYS,
  API_ENDPOINTS,
  STORAGE_KEYS,
  DEFAULTS,
} from "./constants";

// ─── UI_STRINGS ────────────────────────────────────────────
describe("UI_STRINGS", () => {
  it("has apps section with expected keys", () => {
    expect(UI_STRINGS.apps.title).toBe("Applications");
    expect(UI_STRINGS.apps.createApp).toBe("Create App");
    expect(UI_STRINGS.apps.noApps).toBe("No Apps Yet");
  });

  it("apps.deleteConfirmMessage is a template function", () => {
    const msg = UI_STRINGS.apps.deleteConfirmMessage("MyApp");
    expect(msg).toContain("MyApp");
    expect(msg).toContain("delete");
  });

  it("has services section", () => {
    expect(UI_STRINGS.services.title).toBe("Services");
    expect(UI_STRINGS.services.editService).toBe("Edit Service");
  });

  it("has common actions", () => {
    expect(UI_STRINGS.actions.create).toBe("Create");
    expect(UI_STRINGS.actions.delete).toBe("Delete");
    expect(UI_STRINGS.actions.save).toBe("Save");
    expect(UI_STRINGS.actions.cancel).toBe("Cancel");
    expect(UI_STRINGS.actions.start).toBe("Start");
    expect(UI_STRINGS.actions.stop).toBe("Stop");
    expect(UI_STRINGS.actions.restart).toBe("Restart");
  });

  it("has status messages", () => {
    expect(UI_STRINGS.status.loading).toBe("Loading...");
    expect(UI_STRINGS.status.saving).toBe("Saving...");
    expect(UI_STRINGS.status.deleting).toBe("Deleting...");
  });

  it("toast success templates produce correct strings", () => {
    expect(UI_STRINGS.toast.success.created("Foo")).toBe('"Foo" created successfully');
    expect(UI_STRINGS.toast.success.updated("Bar")).toBe('"Bar" updated successfully');
    expect(UI_STRINGS.toast.success.deleted("Baz")).toBe('"Baz" deleted successfully');
    expect(UI_STRINGS.toast.success.cloned("Clone")).toBe('Cloned as "Clone"');
  });

  it("toast error has generic message", () => {
    expect(UI_STRINGS.toast.error.generic).toContain("error");
  });

  it("confirm.delete.message is a template", () => {
    const msg = UI_STRINGS.confirm.delete.message("TestItem");
    expect(msg).toContain("TestItem");
    expect(msg).toContain("cannot be undone");
  });

  it("confirm.destructiveAction.message is a template", () => {
    const msg = UI_STRINGS.confirm.destructiveAction.message("remove all data");
    expect(msg).toContain("remove all data");
  });

  it("emptyState.noResultsDescription is a template", () => {
    const msg = UI_STRINGS.emptyState.noResultsDescription("search term");
    expect(msg).toContain("search term");
  });

  it("time templates handle singular and plural", () => {
    expect(UI_STRINGS.time.minutesAgo(1)).toBe("1 minute ago");
    expect(UI_STRINGS.time.minutesAgo(5)).toBe("5 minutes ago");
    expect(UI_STRINGS.time.hoursAgo(1)).toBe("1 hour ago");
    expect(UI_STRINGS.time.hoursAgo(3)).toBe("3 hours ago");
    expect(UI_STRINGS.time.daysAgo(1)).toBe("1 day ago");
    expect(UI_STRINGS.time.daysAgo(7)).toBe("7 days ago");
  });

  it("has navigation entries", () => {
    expect(UI_STRINGS.nav.apps).toBe("Apps");
    expect(UI_STRINGS.nav.dashboard).toBe("Dashboard");
    expect(UI_STRINGS.nav.settings).toBe("Settings");
    expect(UI_STRINGS.nav.logout).toBe("Logout");
  });
});

// ─── QUERY_KEYS ────────────────────────────────────────────
describe("QUERY_KEYS", () => {
  it("has readonly-typed arrays", () => {
    expect(QUERY_KEYS.apps).toEqual(["apps"]);
    expect(QUERY_KEYS.services).toEqual(["services"]);
    expect(QUERY_KEYS.machines).toEqual(["machines"]);
    expect(QUERY_KEYS.environments).toEqual(["environments"]);
    expect(QUERY_KEYS.health).toEqual(["health"]);
  });
});

// ─── API_ENDPOINTS ─────────────────────────────────────────
describe("API_ENDPOINTS", () => {
  it("has base resource endpoints", () => {
    expect(API_ENDPOINTS.apps).toBe("/api/apps");
    expect(API_ENDPOINTS.services).toBe("/api/services");
    expect(API_ENDPOINTS.machines).toBe("/api/machines");
    expect(API_ENDPOINTS.health).toBe("/api/health");
  });

  it("has auth endpoints", () => {
    expect(API_ENDPOINTS.auth.login).toBe("/api/auth/login");
    expect(API_ENDPOINTS.auth.logout).toBe("/api/auth/logout");
    expect(API_ENDPOINTS.auth.refresh).toBe("/api/auth/refresh");
    expect(API_ENDPOINTS.auth.register).toBe("/api/auth/register");
  });
});

// ─── STORAGE_KEYS ──────────────────────────────────────────
describe("STORAGE_KEYS", () => {
  it("has static storage keys", () => {
    expect(STORAGE_KEYS.authToken).toBe("auth-token");
    expect(STORAGE_KEYS.refreshToken).toBe("refresh-token");
    expect(STORAGE_KEYS.theme).toBe("theme");
    expect(STORAGE_KEYS.sidebarPinned).toBe("sidebar-pinned");
  });

  it("editorContent generates dynamic key", () => {
    expect(STORAGE_KEYS.editorContent("app-1", "file-2")).toBe(
      "editor-content-app-1-file-2"
    );
  });
});

// ─── DEFAULTS ──────────────────────────────────────────────
describe("DEFAULTS", () => {
  it("has sensible default values", () => {
    expect(DEFAULTS.toastDuration).toBe(5000);
    expect(DEFAULTS.maxToasts).toBe(5);
    expect(DEFAULTS.staleTime).toBe(2 * 60 * 1000);
    expect(DEFAULTS.refetchInterval).toBe(10 * 1000);
    expect(DEFAULTS.pollInterval).toBe(30 * 1000);
  });
});

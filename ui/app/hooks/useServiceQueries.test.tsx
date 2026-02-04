import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAppsQuery, useAppStatusQuery } from "./useServiceQueries";
import { serviceService } from "~/services/appService";

// Mock the service
vi.mock("~/services/appService", () => ({
  serviceService: {
    getAll: vi.fn(),
    getStatus: vi.fn(),
    getAllStatuses: vi.fn(),
    control: vi.fn(),
  },
}));

// Mock toast context
vi.mock("~/components/Toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock error context
vi.mock("~/context/ErrorContext", () => ({
  useError: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useAppsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches apps successfully", async () => {
    const mockApps = [
      { id: "1", name: "App 1", status: "Running" },
      { id: "2", name: "App 2", status: "Stopped" },
    ];
    vi.mocked(serviceService.getAll).mockResolvedValue(mockApps as never);

    const { result } = renderHook(() => useAppsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockApps);
    expect(serviceService.getAll).toHaveBeenCalledTimes(1);
  });

  it("handles error state", async () => {
    const error = new Error("Network error");
    vi.mocked(serviceService.getAll).mockRejectedValue(error);

    const { result } = renderHook(() => useAppsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe("useAppStatusQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches app status from batch endpoint", async () => {
    const mockStatuses = { "app-1": "Running", "app-2": "Stopped" };
    vi.mocked(serviceService.getAllStatuses).mockResolvedValue(mockStatuses);

    const { result } = renderHook(() => useAppStatusQuery("app-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe("Running");
    expect(serviceService.getAllStatuses).toHaveBeenCalled();
  });

  it("returns Unknown for unknown service id", async () => {
    const mockStatuses = { "app-1": "Running" };
    vi.mocked(serviceService.getAllStatuses).mockResolvedValue(mockStatuses);

    const { result } = renderHook(() => useAppStatusQuery("app-unknown"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe("Unknown");
  });
});

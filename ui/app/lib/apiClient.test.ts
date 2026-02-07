import { describe, it, expect } from "vitest";
import { getApiErrorMessage } from "./apiClient";
import axios, { AxiosError, AxiosHeaders } from "axios";

describe("getApiErrorMessage", () => {
  it("returns fallback for null/undefined", () => {
    expect(getApiErrorMessage(null)).toBe("An error occurred");
    expect(getApiErrorMessage(undefined)).toBe("An error occurred");
  });

  it("returns custom fallback when provided", () => {
    expect(getApiErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });

  it("extracts message from standard Error", () => {
    expect(getApiErrorMessage(new Error("Something broke"))).toBe("Something broke");
  });

  it("extracts message from Axios error response data", () => {
    const error = new AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        data: { message: "Service not found" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    );

    expect(getApiErrorMessage(error)).toBe("Service not found");
  });

  it("falls back to axios message when no response data message", () => {
    const error = new AxiosError("Network Error");
    expect(getApiErrorMessage(error)).toBe("Network Error");
  });

  it("returns fallback for non-Error types", () => {
    expect(getApiErrorMessage("string error")).toBe("An error occurred");
    expect(getApiErrorMessage(42)).toBe("An error occurred");
    expect(getApiErrorMessage({})).toBe("An error occurred");
  });
});

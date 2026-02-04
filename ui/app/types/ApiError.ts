import type { AxiosError } from "axios";

/**
 * Standard API error response from the backend
 */
export interface ApiErrorResponse {
  error?: string;
  message?: string;
  errorMessage?: string;
  details?: string;
  errorDetails?: string;
  serviceId?: string;
  statusCode?: number;
  traceId?: string;
}

/**
 * Typed API error that extends the standard Error with additional context
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: string;
  readonly serviceId?: string;
  readonly traceId?: string;
  readonly originalError?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: {
      details?: string;
      serviceId?: string;
      traceId?: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = options?.details;
    this.serviceId = options?.serviceId;
    this.traceId = options?.traceId;
    this.originalError = options?.originalError;
  }

  /**
   * Create an ApiError from an Axios error response
   */
  static fromAxiosError(error: AxiosError<ApiErrorResponse>): ApiError {
    const response = error.response;
    const data = response?.data;

    const message =
      data?.error ||
      data?.errorMessage ||
      data?.message ||
      error.message ||
      "An unexpected error occurred";

    return new ApiError(message, response?.status || 500, {
      details: data?.details || data?.errorDetails,
      serviceId: data?.serviceId,
      traceId: data?.traceId,
      originalError: error,
    });
  }

  /**
   * Create an ApiError from an unknown error
   */
  static fromUnknown(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message, 500, { originalError: error });
    }

    return new ApiError(String(error), 500, { originalError: error });
  }
}

/**
 * Type guard to check if an error is an AxiosError with our expected response shape
 */
export function isAxiosApiError(
  error: unknown
): error is AxiosError<ApiErrorResponse> {
  return (
    error != null &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Extract a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (isAxiosApiError(error)) {
    const data = error.response?.data;
    return (
      data?.error ||
      data?.errorMessage ||
      data?.message ||
      error.message ||
      "An unexpected error occurred"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Extract error details if available
 */
export function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.details;
  }

  if (isAxiosApiError(error)) {
    return error.response?.data?.details || error.response?.data?.errorDetails;
  }

  return undefined;
}

/**
 * Common HTTP error status handlers
 */
export const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Bad Request - Please check your input",
  401: "Unauthorized - Please log in again",
  403: "Forbidden - You don't have permission to perform this action",
  404: "Not Found - The requested resource doesn't exist",
  409: "Conflict - This action conflicts with an existing resource",
  422: "Validation Error - Please check your input",
  429: "Too Many Requests - Please slow down",
  500: "Server Error - Something went wrong on our end",
  502: "Bad Gateway - The server is temporarily unavailable",
  503: "Service Unavailable - Please try again later",
  504: "Gateway Timeout - The request took too long",
};

/**
 * Get a user-friendly message for an HTTP status code
 */
export function getHttpErrorMessage(statusCode: number): string {
  return HTTP_ERROR_MESSAGES[statusCode] || `Error (${statusCode})`;
}

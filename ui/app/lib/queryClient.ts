import { QueryClient } from "@tanstack/react-query";
import { setupGlobalQueryErrorHandler } from "~/hooks/useErrorHandledMutation";

// Track connection status for query retry logic
let isBackendConnected = true;

export function setBackendConnectionStatus(connected: boolean) {
  isBackendConnected = connected;
}

export function getBackendConnectionStatus() {
  return isBackendConnected;
}

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache time of 10 minutes
      gcTime: 10 * 60 * 1000,
      // Smart retry: don't retry when backend is known to be down
      retry: (failureCount, error) => {
        // Don't retry if we know backend is down
        if (!isBackendConnected) return false;
        // Otherwise retry up to 2 times (reduced from 3)
        return failureCount < 2;
      },
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Only refetch on window focus when connected
      refetchOnWindowFocus: () => isBackendConnected,
      // Refetch on mount if data is stale
      refetchOnMount: true,
      // Don't refetch on reconnect - we handle this in ConnectionContext
      refetchOnReconnect: false,
    },
    mutations: {
      // Don't retry mutations when offline
      retry: (failureCount, error) => {
        if (!isBackendConnected) return false;
        return failureCount < 1;
      },
    },
  },
});

// Setup error handling for the query client.
// This is helpful, but we also use the ErrorProvider to handle errors more globally.
// Since we can't access the ErrorProvider context here (it's initialized later),
// we'll do basic error logging. The ErrorProvider will handle more sophisticated error display.
setupGlobalQueryErrorHandler(queryClient, (error: Error) => {
  console.error("Query error:", error);

  // You can add additional global error handling here.
  // Any uncaught or unhandled query errors will be processed here.
});

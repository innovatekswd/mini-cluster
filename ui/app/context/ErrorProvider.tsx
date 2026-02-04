import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/components/Toast";
import { getBackendConnectionStatus } from "~/lib/queryClient";

// Promise messages type for toastPromise
interface PromiseMessages {
  loading: string;
  success: string;
  error: string;
}

// Error handling context type
interface ErrorContextType {
  showError: (message: string, error?: any) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  clearErrors: () => void;
  toastPromise: <T>(promise: Promise<T>, messages: PromiseMessages) => Promise<T>;
}

// Create the context
const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

// Debounce time for connection errors (show max 1 per 30 seconds when offline)
const CONNECTION_ERROR_DEBOUNCE_MS = 30000;

// Inner component that uses toast
const ErrorProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [errors, setErrors] = useState<string[]>([]);
  const lastConnectionErrorRef = useRef<number>(0);

  // Set up global error handler for React Query
  React.useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && 
          event.query.state.status === "error" && 
          event.query.state.error) {
        
        // If backend is known to be disconnected, suppress all query errors
        // The ConnectionContext already shows a "Connection Lost" notification
        if (!getBackendConnectionStatus()) {
          return;
        }
        
        const error = event.query.state.error;
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        
        // Only show network errors, not all query errors
        // And debounce to prevent flooding
        if (message.includes("Network") || message.includes("connect") || message.includes("ECONNREFUSED") || message.includes("fetch")) {
          const now = Date.now();
          if (now - lastConnectionErrorRef.current > CONNECTION_ERROR_DEBOUNCE_MS) {
            lastConnectionErrorRef.current = now;
            
            // Extract query key for context
            const queryKey = event.query.queryKey;
            let context = "";
            if (Array.isArray(queryKey)) {
              if (queryKey.includes("apps")) {
                if (queryKey.includes("status")) {
                  context = "fetching service status";
                } else if (queryKey.includes("args")) {
                  context = "fetching service arguments";
                } else if (queryKey.includes("env")) {
                  context = "fetching environment variables";
                } else {
                  context = "fetching services list";
                }
              } else if (queryKey.includes("health")) {
                context = "checking server health";
              } else {
                context = "fetching data";
              }
            }
            
            toast.error(
              `Failed while ${context}. Server may be offline or unreachable.`, 
              "Connection Error"
            );
          }
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient, toast]);

  const showError = useCallback((message: string, errorOrTitle?: any) => {
    // If second param is a string, treat it as title
    if (typeof errorOrTitle === 'string') {
      console.error("Error:", errorOrTitle, message);
      setErrors((prev) => [...prev, message]);
      toast.error(message, errorOrTitle);
    } else {
      // It's an error object, extract details
      const error = errorOrTitle;
      console.error("Error:", message, error);
      setErrors((prev) => [...prev, message]);
      
      // Check for error details (from enhanced API response)
      const details = error?.details || error?.response?.data?.errorDetails;
      if (details) {
        toast.error(`${message}\n\n${details}`, "Error");
      } else {
        toast.error(message, "Error");
      }
    }
  }, [toast]);

  const showSuccess = useCallback((message: string) => {
    toast.success(message);
  }, [toast]);

  const showInfo = useCallback((message: string) => {
    toast.info(message);
  }, [toast]);

  const showWarning = useCallback((message: string) => {
    toast.warning(message);
  }, [toast]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    toast.dismissAll();
  }, [toast]);

  const toastPromise = useCallback(<T,>(promise: Promise<T>, messages: PromiseMessages): Promise<T> => {
    return toast.promise(promise, messages);
  }, [toast]);

  return (
    <ErrorContext.Provider
      value={{
        showError,
        showSuccess,
        showInfo,
        showWarning,
        clearErrors,
        toastPromise,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
};

// Wrapper that doesn't need toast context
export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <ErrorProviderInner>{children}</ErrorProviderInner>;
};

// Custom hook to use the error context
export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error("useError must be used within an ErrorProvider");
  }
  return context;
};

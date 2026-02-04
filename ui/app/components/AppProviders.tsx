import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "~/lib/queryClient";
import { AuthProvider } from "~/context/AuthContext";
import { ToastProvider } from "~/components/Toast";
import { ConfirmProvider } from "~/components/ConfirmDialog";
import { ErrorProvider } from "~/context/ErrorProvider";
import { ConnectionProvider } from "~/context/ConnectionContext";
import { LogProvider } from "~/context/LogContext";
import { SignalRConnectionProvider } from "~/context/SignalRConnectionContext";
import { AppStatusProvider } from "~/context/AppStatusContext";
import { VariableGroupProvider } from "~/context/VariableGroupContext";

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Compound provider component that combines all app-level context providers.
 * This reduces nesting in root.tsx and makes the provider structure more manageable.
 * 
 * Provider order (outer to inner):
 * 1. QueryClientProvider - React Query state management
 * 2. AuthProvider - Authentication state
 * 3. ToastProvider - Toast notifications
 * 4. ConfirmProvider - Confirmation dialogs
 * 5. ErrorProvider - Global error handling
 * 6. ConnectionProvider - API connection status
 * 7. LogProvider - Log streaming
 * 8. SignalRConnectionProvider - Real-time connections
 * 9. AppStatusProvider - App/service status tracking
 * 10. VariableGroupProvider - Environment variable groups
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider position="bottom-right" maxToasts={5}>
          <ConfirmProvider>
            <ErrorProvider>
              <ConnectionProvider>
                <LogProvider>
                  <SignalRConnectionProvider>
                    <AppStatusProvider>
                      <VariableGroupProvider>
                        {children}
                      </VariableGroupProvider>
                    </AppStatusProvider>
                  </SignalRConnectionProvider>
                </LogProvider>
              </ConnectionProvider>
            </ErrorProvider>
          </ConfirmProvider>
        </ToastProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Minimal providers for pages that don't need all context.
 * Useful for isolated pages like login or error pages.
 */
export function MinimalProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider position="bottom-right" maxToasts={5}>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

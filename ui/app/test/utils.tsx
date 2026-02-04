import React, { type ReactElement, type ReactNode } from "react";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

// Create a test query client with default settings for testing
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

type WrapperProps = {
  children: ReactNode;
};

// Provider wrapper for tests
function createWrapper() {
  const queryClient = createTestQueryClient();
  
  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// Custom render that wraps components with all required providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient();
  
  const Wrapper = ({ children }: WrapperProps) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { renderWithProviders as render };

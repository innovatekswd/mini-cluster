import { createContext, useContext, type ReactNode } from "react";
import type { Environment } from "~/types/Environment";
import {
  useActiveEnvironmentQuery,
  useSetActiveEnvironmentMutation,
} from "~/hooks/useEnvironmentQueries";
import { useError } from "./ErrorProvider";

type EnvironmentContextType = {
  activeEnvironment: Environment | null;
  isLoading: boolean;
  setActiveEnvironment: (env: Environment) => Promise<void>;
  resolveVariable: (key: string) => string;
};

const EnvironmentContext = createContext<EnvironmentContextType | null>(
  null
);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const { showError } = useError();

  // Use React Query for active environment
  const { data: activeEnvironment = null, isLoading } = useActiveEnvironmentQuery();

  // Use mutation to set active environment
  const setActiveEnvironmentMutation = useSetActiveEnvironmentMutation();

  const setActiveEnvironment = async (env: Environment) => {
    try {
      await setActiveEnvironmentMutation.mutateAsync(env.name);
    } catch (error) {
      showError("Failed to set active environment", error);
      throw error;
    }
  };
  const resolveVariable = (key: string): string => {
    if (!activeEnvironment) return key;
    return key.replace(/\{([^}]+)\}/g, (match, path) => {
      return (
        path
          .split(".")
          .reduce(
            (obj: Record<string, any> | undefined, key: string) => obj?.[key],
            activeEnvironment.variables
          ) ?? match
      );
    });
  };

  return (
    <EnvironmentContext.Provider
      value={{
        activeEnvironment,
        isLoading,
        setActiveEnvironment,
        resolveVariable,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error(
      "useEnvironment must be used within an EnvironmentProvider"
    );
  }
  return context;
}

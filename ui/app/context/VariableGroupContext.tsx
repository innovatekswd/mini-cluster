import { createContext, useContext, type ReactNode } from "react";
import type { VariableGroup } from "~/types/VariableGroup";
import {
  useActiveVariableGroupQuery,
  useSetActiveVariableGroupMutation,
} from "~/hooks/useVariableGroupQueries";
import { useError } from "./ErrorProvider";

type VariableGroupContextType = {
  activeGroup: VariableGroup | null;
  isLoading: boolean;
  setActiveGroup: (group: VariableGroup) => Promise<void>;
  resolveVariable: (key: string) => string;
};

const VariableGroupContext = createContext<VariableGroupContextType | null>(
  null
);

export function VariableGroupProvider({ children }: { children: ReactNode }) {
  const { showError } = useError();

  // Use React Query for active variable group
  const { data: activeGroup = null, isLoading } = useActiveVariableGroupQuery();

  // Use mutation to set active group
  const setActiveGroupMutation = useSetActiveVariableGroupMutation();

  const setActiveGroup = async (group: VariableGroup) => {
    try {
      await setActiveGroupMutation.mutateAsync(group.id);
    } catch (error) {
      showError("Failed to set active variable group", error);
      throw error;
    }
  };
  const resolveVariable = (key: string): string => {
    if (!activeGroup) return key;
    return key.replace(/\{([^}]+)\}/g, (match, path) => {
      return (
        path
          .split(".")
          .reduce(
            (obj: Record<string, any> | undefined, key: string) => obj?.[key],
            activeGroup.variables
          ) ?? match
      );
    });
  };

  return (
    <VariableGroupContext.Provider
      value={{
        activeGroup,
        isLoading,
        setActiveGroup,
        resolveVariable,
      }}
    >
      {children}
    </VariableGroupContext.Provider>
  );
}

export function useVariableGroup() {
  const context = useContext(VariableGroupContext);
  if (!context) {
    throw new Error(
      "useVariableGroup must be used within a VariableGroupProvider"
    );
  }
  return context;
}

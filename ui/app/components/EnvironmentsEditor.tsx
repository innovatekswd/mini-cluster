import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaPlus, FaCheck, FaTrash, FaLayerGroup, FaEdit, FaTimes } from "react-icons/fa";
import { EnvEditor } from "./EnvEditor";
import { Modal } from "./Modal";
import {
  useEnvironmentsQuery,
  useCreateEnvironmentMutation,
  useUpdateEnvironmentMutation,
  useDeleteEnvironmentMutation,
  useSetActiveEnvironmentMutation,
} from "~/hooks/useEnvironmentQueries";
import { useError } from "~/context/ErrorProvider";
import type { Environment } from "~/types/Environment";
// import { throttle } from "~/utils/throttle";
import { debounce } from "~/utils/debounce";

interface Tab {
  key: string;
  label: string;
  isActive: boolean;
}

interface TabsProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  tabs: Tab[];
  onDeleteTab: (tabKey: string) => void;
  onSetActiveTab: (tabKey: string) => void;
  onRenameTab: (tabKey: string, newLabel: string) => void;
}

const Tabs: React.FC<TabsProps> = ({
  activeTab,
  onTabChange,
  tabs,
  onDeleteTab,
  onSetActiveTab,
  onRenameTab,
}) => {
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTab && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingTab]);

  const handleRename = (tabKey: string) => {
    const trimmedLabel = newLabel.trim();
    const originalTab = tabs.find(t => t.key === tabKey);
    const hasChanged = trimmedLabel && originalTab && trimmedLabel !== originalTab.label;
    
    if (hasChanged) {
      onRenameTab(tabKey, trimmedLabel);
    }
    setEditingTab(null);
    setNewLabel("");
  };

  return (
    <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-700/50">
      {tabs.map((tab) => (
        <div 
          key={tab.key} 
          onClick={() => !editingTab && onTabChange(tab.key)}
          className={`
            group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer
            ${activeTab === tab.key 
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
              : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50'}
          `}
        >
          {editingTab === tab.key ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                ref={inputRef}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onBlur={() => handleRename(tab.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename(tab.key);
                  } else if (e.key === "Escape") {
                    setEditingTab(null);
                    setNewLabel("");
                  }
                }}
                className="bg-slate-700 text-white px-2 py-1 rounded-lg text-sm w-32
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="Rename tab"
              />
              <button
                onClick={() => {
                  setEditingTab(null);
                  setNewLabel("");
                }}
                title="Cancel rename"
                className="text-slate-500 hover:text-slate-300"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ) : (
            <>
              {/* Tab label with active indicator */}
              <div className={`font-medium text-sm flex items-center gap-2
                ${activeTab === tab.key ? 'text-cyan-400' : 'text-slate-300'}
              `}>
                {tab.isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
                {tab.label}
              </div>
              
              {/* Action buttons - visible on hover */}
              <div 
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setEditingTab(tab.key);
                    setNewLabel(tab.label);
                  }}
                  className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-600/50"
                  title="Rename"
                >
                  <FaEdit size={12} />
                </button>
                <button
                  onClick={() => onSetActiveTab(tab.key)}
                  className={`p-1.5 rounded transition-colors ${
                    tab.isActive 
                      ? "text-emerald-400" 
                      : "text-slate-500 hover:text-emerald-400 hover:bg-slate-600/50"
                  }`}
                  title="Set as Default"
                >
                  <FaCheck size={12} />
                </button>
                <button
                  onClick={() => onDeleteTab(tab.key)}
                  className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-600/50"
                  title="Delete"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

interface CreateEnvironmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isSubmitting: boolean;
}

const CreateEnvironmentDialog: React.FC<CreateEnvironmentDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    onSubmit(trimmedName);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Environment"
      size="sm"
      disableClose={isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-env-form"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </>
      }
    >
      <form id="create-env-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="env-name" className="block text-sm font-medium text-slate-300 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            ref={inputRef}
            type="text"
            id="env-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g., Production, Staging, Development"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:border-cyan-500 focus:ring-cyan-500"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export const EnvironmentsEditor: React.FC = () => {
  const {
    data: rawEnvironments,
    isLoading,
    error: queryError,
  } = useEnvironmentsQuery();
  const environments = Array.isArray(rawEnvironments) ? rawEnvironments : [];
  const [activeEnvironmentName, setActiveEnvironmentName] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { showError, showSuccess } = useError();
  const autoActivatedRef = useRef(false);

  const createEnvironmentMutation = useCreateEnvironmentMutation();
  const updateEnvironmentMutation = useUpdateEnvironmentMutation();
  const deleteEnvironmentMutation = useDeleteEnvironmentMutation();
  const setActiveEnvironmentMutation = useSetActiveEnvironmentMutation();

  useEffect(() => {
    const currentSelectionIsValid =
      activeEnvironmentName && environments.some((g) => g.name === activeEnvironmentName);

    if (!currentSelectionIsValid) {
      // If current selection is invalid (null or points to a deleted environment), then initialize.
      const backendActiveEnvironment = environments.find((g) => g.isActive);
      if (backendActiveEnvironment) {
        setActiveEnvironmentName(backendActiveEnvironment.name);
        autoActivatedRef.current = false; // Reset since we found an active one
      } else if (environments.length > 0) {
        // No backend active environment, default to the first environment and activate it
        setActiveEnvironmentName(environments[0].name);
        // Auto-activate the first environment in the backend (only once)
        if (!autoActivatedRef.current) {
          autoActivatedRef.current = true;
          setActiveEnvironmentMutation.mutate(environments[0].name);
        }
      } else {
        // No environments at all
        setActiveEnvironmentName(null);
        autoActivatedRef.current = false;
      }
    }
    // If currentSelectionIsValid is true, this effect does nothing, preserving the current tab.
    // Explicit actions like handleSetActive, onTabChange, or handleAddEnvironment's onSuccess
    // are responsible for changing activeEnvironmentName.
  }, [environments, activeEnvironmentName, setActiveEnvironmentMutation]);

  // Show error message if query fails
  useEffect(() => {
    if (queryError) {
      showError("Failed to load environments", queryError);
    }
  }, [queryError, showError]);

  const handleAddEnvironment = (name: string) => {
    createEnvironmentMutation.mutate(
      {
        name,
        variables: {},
      },
      {
        onSuccess: (newEnvironment) => {
          showSuccess(`Environment "${name}" created successfully`);
          setActiveEnvironmentName(newEnvironment.name);
          setIsCreateDialogOpen(false);
        },
        onError: (error) => {
          showError("Failed to create environment", error);
        },
      }
    );
  };
  const handleUpdateEnvironment = async (
    updatedEnvironment: Environment,
    showToastOnSuccess = true
  ) => {
    try {
      await updateEnvironmentMutation.mutateAsync({
        name: updatedEnvironment.name,
        data: {
          name: updatedEnvironment.name,
          description: updatedEnvironment.description,
          variables: updatedEnvironment.variables,
        },
      });
      // Only show success toast if not part of a rapid update sequence
      // The individual variable change doesn't need a toast each time.
      if (showToastOnSuccess) {
        showSuccess(`Environment "${updatedEnvironment.name}" updated successfully`);
      }
    } catch (error) {
      console.error("Error updating environment:", error);
      showError("Failed to update environment", error);
    }
  };

  const handleDeleteEnvironment = async (environmentName: string) => {
    if (!confirm("Are you sure you want to delete this environment?")) return;

    try {
      await deleteEnvironmentMutation.mutateAsync(environmentName);
      // If the deleted environment was active, activeEnvironmentName will become invalid.
      // The useEffect above will handle resetting it to a valid environment or null.
      showSuccess("Environment deleted successfully");
    } catch (error) {
      console.error("Error deleting environment:", error);
      showError("Failed to delete environment");
    }
  };

  const handleSetActive = async (environmentName: string) => {
    try {
      await setActiveEnvironmentMutation.mutateAsync(environmentName);
      showSuccess("Active environment updated successfully");
      // Ensure the UI tab switches to the newly activated environment
      setActiveEnvironmentName(environmentName);
    } catch (error) {
      console.error("Error setting active environment:", error);
      showError("Failed to set active environment", error);
    }
  };

  // Throttle the handleVariablesChange function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleVariablesChange = useCallback(
    debounce(async (environmentName: string, variables: Record<string, string>) => {
      const updatedEnvironment = environments.find((g) => g.name === environmentName);
      if (updatedEnvironment) {
        // Pass false to prevent handleUpdateEnvironment from showing its own toast here
        await handleUpdateEnvironment({ ...updatedEnvironment, variables }, false);
        // A toast can be added here if desired after debounced update
        showSuccess(`Environment "${updatedEnvironment.name}" variables saved.`);
      }
    }, 1000), // Debounce to 1 second
    [environments, showSuccess]
  );

  const handleVariablesChange = async (
    environmentName: string,
    variables: Record<string, string>
  ) => {
    // Call the debounced version
    debouncedHandleVariablesChange(environmentName, variables);
  };

  const handleRenameTab = async (environmentName: string, newName: string) => {
    const updatedEnvironment = environments.find((g) => g.name === environmentName);
    if (updatedEnvironment) {
      // This call will use the default showToastOnSuccess = true
      await handleUpdateEnvironment({ ...updatedEnvironment, name: newName });
    }
  };

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 
            flex items-center justify-center shadow-lg shadow-violet-500/20">
            <FaLayerGroup className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Environments</h2>
            <p className="text-sm text-slate-500">Manage environment variable sets</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <FaPlus size={14} /> Add Environment
        </button>
      </div>

      {queryError && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 
          text-rose-400 p-4 rounded-xl fade-in">
          <span>{queryError.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin"></div>
          <span className="text-slate-400">Loading environments...</span>
        </div>
      ) : (
        <>
          {environments.length === 0 && !queryError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 
                flex items-center justify-center mb-4">
                <FaLayerGroup className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-lg font-medium text-slate-400 mb-2">No Environments</p>
              <p className="text-sm text-slate-500 mb-6">Create your first environment to manage environment variables</p>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <FaPlus size={14} /> Create Environment
              </button>
            </div>
          ) : (
            <Tabs
              activeTab={
                activeEnvironmentName || (environments.length > 0 ? environments[0].name : "")
              }
              onTabChange={setActiveEnvironmentName}
              tabs={environments.map((environment) => ({
                key: environment.name,
                label: environment.name,
                isActive: environment.isActive, // This passes the isActive property from your data
              }))}
              onDeleteTab={handleDeleteEnvironment}
              onSetActiveTab={handleSetActive}
              onRenameTab={handleRenameTab}
            />
          )}

          {environments.map((environment) => (
            <div
              key={environment.slug || environment.name}
              className={`card ${activeEnvironmentName === environment.name ? "fade-in" : "hidden"}`}
            >
              <EnvEditor // Use EnvEditor here
                envVars={Object.entries(environment.variables || {}).map(
                  ([key, value]) => ({ key, value })
                )}
                onChange={(vars) => {
                  const variables: Record<string, string> = vars.reduce(
                    (obj: Record<string, string>, item) => {
                      obj[item.key] = item.value;
                      return obj;
                    },
                    {} as Record<string, string>
                  );
                  handleVariablesChange(environment.name, variables);
                }}
              />
            </div>
          ))}
        </>
      )}

      <CreateEnvironmentDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleAddEnvironment}
        isSubmitting={createEnvironmentMutation.isPending}
      />
    </div>
  );
};

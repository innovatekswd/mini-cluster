import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaPlus, FaCheck, FaTrash, FaLayerGroup, FaEdit, FaTimes } from "react-icons/fa";
import { EnvEditor } from "./EnvEditor"; // Import EnvEditor
import {
  useVariableGroupsQuery,
  useCreateVariableGroupMutation,
  useUpdateVariableGroupMutation,
  useDeleteVariableGroupMutation,
  useSetActiveVariableGroupMutation,
} from "~/hooks/useVariableGroupQueries";
import { useError } from "~/context/ErrorProvider";
import type { VariableGroup } from "~/types/VariableGroup";
// import { throttle } from "~/utils/throttle"; // Import throttle
import { debounce } from "~/utils/debounce"; // Import debounce

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
    if (newLabel.trim()) {
      onRenameTab(tabKey, newLabel);
      setEditingTab(null);
      setNewLabel("");
    } else {
      setEditingTab(null);
      setNewLabel("");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-700/50">
      {tabs.map((tab) => (
        <div 
          key={tab.key} 
          className={`
            group flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200
            ${activeTab === tab.key 
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
              : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50'}
          `}
        >
          {editingTab === tab.key ? (
            <div className="flex items-center gap-2">
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
                className="text-slate-500 hover:text-slate-300"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onTabChange(tab.key)}
                className={`font-medium text-sm flex items-center gap-2
                  ${activeTab === tab.key ? 'text-cyan-400' : 'text-slate-300'}
                `}
                onDoubleClick={() => {
                  setEditingTab(tab.key);
                  setNewLabel(tab.label);
                }}
              >
                {tab.isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
                {tab.label}
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingTab(tab.key);
                    setNewLabel(tab.label);
                  }}
                  className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-600/50"
                  title="Rename"
                >
                  <FaEdit size={10} />
                </button>
                <button
                  onClick={() => onSetActiveTab(tab.key)}
                  className={`p-1 rounded transition-colors ${
                    tab.isActive 
                      ? "text-emerald-400" 
                      : "text-slate-500 hover:text-emerald-400 hover:bg-slate-600/50"
                  }`}
                  title="Set Active"
                >
                  <FaCheck size={10} />
                </button>
                <button
                  onClick={() => onDeleteTab(tab.key)}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-600/50"
                  title="Delete"
                >
                  <FaTrash size={10} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

const NewVariableGroupForm: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    variables: Record<string, string>;
  }) => void;
}> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variables, setVariables] = useState<{ key: string; value: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onCreate({
      name,
      description,
      variables: variables.reduce((acc, { key, value }) => {
        if (key.trim()) acc[key] = value;
        return acc;
      }, {} as Record<string, string>),
    });
    setLoading(false);
    setName("");
    setDescription("");
    setVariables([]);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add Variable Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            title="Close"
            aria-label="Close form"
          >
            <FaTrash />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Variables
            </label>
            <EnvEditor envVars={variables} onChange={setVariables} />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const VariableGroupsEditor: React.FC = () => {
  const {
    data: groups = [],
    isLoading,
    error: queryError,
  } = useVariableGroupsQuery();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const { showError, showSuccess } = useError();

  const createGroupMutation = useCreateVariableGroupMutation();
  const updateGroupMutation = useUpdateVariableGroupMutation();
  const deleteGroupMutation = useDeleteVariableGroupMutation();
  const setActiveGroupMutation = useSetActiveVariableGroupMutation();

  useEffect(() => {
    const currentSelectionIsValid =
      activeGroupId && groups.some((g) => g.id === activeGroupId);

    if (!currentSelectionIsValid) {
      // If current selection is invalid (null or points to a deleted group), then initialize.
      const backendActiveGroup = groups.find((g) => g.isActive);
      if (backendActiveGroup) {
        setActiveGroupId(backendActiveGroup.id);
      } else if (groups.length > 0) {
        // No backend active group, default to the first group
        setActiveGroupId(groups[0].id);
      } else {
        // No groups at all
        setActiveGroupId(null);
      }
    }
    // If currentSelectionIsValid is true, this effect does nothing, preserving the current tab.
    // Explicit actions like handleSetActive, onTabChange, or handleAddGroup's onSuccess
    // are responsible for changing activeGroupId.
  }, [groups, activeGroupId]);

  // Show error message if query fails
  useEffect(() => {
    if (queryError) {
      showError("Failed to load variable groups", queryError);
    }
  }, [queryError, showError]);

  const handleAddGroup = async () => {
    const newName = prompt("Enter new group name:");
    if (newName?.trim()) {
      try {
        createGroupMutation.mutate(
          {
            name: newName.trim(),
            variables: {},
          },
          {
            onSuccess: (newGroup) => {
              showSuccess(`Group "${newName}" created successfully`);
              setActiveGroupId(newGroup.id);
            },
            onError: (error) => {
              showError("Failed to create variable group", error);
            },
          }
        );
      } catch (error) {
        showError("Failed to create variable group", error);
      }
    }
  };
  const handleUpdateGroup = async (
    updatedGroup: VariableGroup,
    showToastOnSuccess = true
  ) => {
    try {
      await updateGroupMutation.mutateAsync({
        id: updatedGroup.id,
        data: {
          name: updatedGroup.name,
          description: updatedGroup.description,
          variables: updatedGroup.variables,
        },
      });
      // Only show success toast if not part of a rapid update sequence
      // The individual variable change doesn't need a toast each time.
      if (showToastOnSuccess) {
        showSuccess(`Group "${updatedGroup.name}" updated successfully`);
      }
    } catch (error) {
      console.error("Error updating group:", error);
      showError("Failed to update group", error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      await deleteGroupMutation.mutateAsync(groupId);
      // If the deleted group was active, activeGroupId will become invalid.
      // The useEffect above will handle resetting it to a valid group or null.
      showSuccess("Group deleted successfully");
    } catch (error) {
      console.error("Error deleting group:", error);
      showError("Failed to delete group");
    }
  };

  const handleSetActive = async (groupId: string) => {
    try {
      await setActiveGroupMutation.mutateAsync(groupId);
      showSuccess("Active group updated successfully");
      // Ensure the UI tab switches to the newly activated group
      setActiveGroupId(groupId);
    } catch (error) {
      console.error("Error setting active group:", error);
      showError("Failed to set active group", error);
    }
  };

  // Throttle the handleVariablesChange function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleVariablesChange = useCallback(
    debounce(async (groupId: string, variables: Record<string, string>) => {
      const updatedGroup = groups.find((g) => g.id === groupId);
      if (updatedGroup) {
        // Pass false to prevent handleUpdateGroup from showing its own toast here
        await handleUpdateGroup({ ...updatedGroup, variables }, false);
        // A toast can be added here if desired after debounced update
        showSuccess(`Group "${updatedGroup.name}" variables saved.`);
      }
    }, 1000), // Debounce to 1 second
    [groups, showSuccess]
  );

  const handleVariablesChange = async (
    groupId: string,
    variables: Record<string, string>
  ) => {
    // Call the debounced version
    debouncedHandleVariablesChange(groupId, variables);
  };

  const handleRenameTab = async (groupId: string, newName: string) => {
    const updatedGroup = groups.find((g) => g.id === groupId);
    if (updatedGroup) {
      // This call will use the default showToastOnSuccess = true
      await handleUpdateGroup({ ...updatedGroup, name: newName });
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
            <h2 className="text-2xl font-semibold text-slate-100">Variable Groups</h2>
            <p className="text-sm text-slate-500">Manage environment variable sets</p>
          </div>
        </div>
        <button
          onClick={handleAddGroup}
          className="btn-primary flex items-center gap-2"
        >
          <FaPlus size={14} /> Add Group
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
          <span className="text-slate-400">Loading variable groups...</span>
        </div>
      ) : (
        <>
          {groups.length === 0 && !queryError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 
                flex items-center justify-center mb-4">
                <FaLayerGroup className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-lg font-medium text-slate-400 mb-2">No Variable Groups</p>
              <p className="text-sm text-slate-500 mb-6">Create your first group to manage environment variables</p>
              <button
                onClick={handleAddGroup}
                className="btn-primary flex items-center gap-2"
              >
                <FaPlus size={14} /> Create Group
              </button>
            </div>
          ) : (
            <Tabs
              activeTab={
                activeGroupId || (groups.length > 0 ? groups[0].id : "")
              }
              onTabChange={setActiveGroupId}
              tabs={groups.map((group) => ({
                key: group.id,
                label: group.name,
                isActive: group.isActive, // This passes the isActive property from your data
              }))}
              onDeleteTab={handleDeleteGroup}
              onSetActiveTab={handleSetActive}
              onRenameTab={handleRenameTab}
            />
          )}

          {groups.map((group) => (
            <div
              key={group.id}
              className={`card ${activeGroupId === group.id ? "fade-in" : "hidden"}`}
            >
              <EnvEditor // Use EnvEditor here
                envVars={Object.entries(group.variables).map(
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
                  handleVariablesChange(group.id, variables);
                }}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
};

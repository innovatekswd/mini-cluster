import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import {
  useAppEnvQuery,
  useUpdateAppEnvMutation,
} from "../hooks/useServiceQueries";

export type EnvVar = { key: string; value: string };

type EnvEditorProps = {
  appId?: string;
  envVars?: EnvVar[];
  onChange?: (vars: EnvVar[]) => void;
  inline?: boolean;
};

export const EnvEditor: React.FC<EnvEditorProps> = ({
  appId,
  envVars: initialEnvVars,
  onChange,
  inline = false,
}) => {
  const [vars, setVars] = useState<EnvVar[]>(() => {
    const initial = initialEnvVars || [];
    return initial.length === 0 ? [{ key: "", value: "" }] : initial;
  });
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  // Use React Query only if appId is provided (for app-specific env vars)
  const envQuery = useAppEnvQuery(appId || "");
  const { data: envData, isLoading } = appId
    ? envQuery
    : { data: undefined, isLoading: false };

  const updateEnvMutation = useUpdateAppEnvMutation({
    onError: (error) => {
      console.error("Error updating environment variables:", error);
      alert("Failed to update environment variables.");
    },
  });

  useEffect(() => {
    if (appId && envData) {
      const envArray = Array.isArray(envData) ? envData : [];
      const hasEmptyRow = envArray.some((v) => !v.key && !v.value);
      const updatedVars = hasEmptyRow
        ? envArray
        : [...envArray, { key: "", value: "" }];
      setVars(updatedVars);
    } else if (initialEnvVars) {
      const hasEmptyRow = vars.some((v) => !v.key && !v.value);
      const updatedVars = hasEmptyRow
        ? vars
        : [...vars, { key: "", value: "" }];
      setVars(updatedVars);
    }
  }, [appId, envData, initialEnvVars]);

  const validateVars = (varsToValidate: EnvVar[]): boolean => {
    const newErrors: { [key: number]: string } = {};
    const keys = new Set<string>();
    let hasError = false;

    varsToValidate.forEach((v, index) => {
      if (v.key.trim()) {
        if (keys.has(v.key.trim())) {
          newErrors[index] = `Duplicate key: ${v.key}`;
          hasError = true;
        }
        keys.add(v.key.trim());
      }
    });

    setErrors(newErrors);
    return !hasError;
  };

  const handleChange = (index: number, field: keyof EnvVar, value: string) => {
    const updated = vars.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    );

    const needsNewRow = updated.every((v) => v.key !== "" || v.value !== "");
    if (needsNewRow) {
      updated.push({ key: "", value: "" });
    }

    setVars(updated);

    // Validate and notify parent only of non-empty, valid entries
    const nonEmptyVars = updated.filter((v) => v.key.trim() !== "");
    if (validateVars(nonEmptyVars)) {
      onChange?.(nonEmptyVars);
    }
  };

  const handleDelete = (index: number) => {
    if (vars.length === 1 && !vars[0].key && !vars[0].value) {
      return;
    }

    const updated = vars.filter((_, i) => i !== index);

    if (updated.length === 0) {
      updated.push({ key: "", value: "" });
    }

    setVars(updated);
    setErrors({}); // Clear errors when deleting

    const nonEmptyVars = updated.filter((v) => v.key.trim() !== "");
    if (validateVars(nonEmptyVars)) {
      onChange?.(nonEmptyVars);
    }
  };
  const handleAdd = () => {
    const updated = [...vars, { key: "", value: "" }];
    setVars(updated);
  };

  const handleSave = () => {
    if (!appId) return;

    const validVars = vars.filter((v) => v.key.trim() !== "");
    if (validateVars(validVars)) {
      updateEnvMutation.mutate({ appId, env: validVars });
    }
  };

  if (appId && isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <span className="w-4 h-4 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin"></span>
        Loading environment variables...
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${inline ? "" : "card"}`}>
      {vars.map((env, index) => (
        <div key={index} className="flex flex-col gap-1 fade-in" style={{ animationDelay: `${index * 50}ms` }}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="KEY"
              value={env.key}
              onChange={(e) => handleChange(index, "key", e.target.value)}
              className={`px-3 py-2 rounded-lg w-1/3 bg-slate-700/50 text-slate-100 font-mono text-sm
                placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2
                ${errors[index] 
                  ? "border border-rose-500 focus:ring-rose-500/50" 
                  : "border border-slate-600 focus:ring-cyan-500/50 focus:border-cyan-500"}`}
            />
            <input
              type="text"
              placeholder="VALUE"
              value={env.value}
              onChange={(e) => handleChange(index, "value", e.target.value)}
              className="px-3 py-2 rounded-lg flex-1 bg-slate-700/50 text-slate-100 font-mono text-sm
                placeholder-slate-500 border border-slate-600 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => handleDelete(index)}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 
                transition-all duration-200"
              title="Delete variable"
            >
              <FaTrash size={14} />
            </button>
          </div>
          {errors[index] && (
            <span className="text-rose-400 text-xs pl-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-rose-400"></span>
              {errors[index]}
            </span>
          )}
        </div>
      ))}
      <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
        <button
          onClick={handleAdd}
          type="button"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 
            transition-colors duration-200"
        >
          <FaPlus size={12} /> Add Variable
        </button>
        {appId && (
          <button
            onClick={handleSave}
            disabled={updateEnvMutation.isPending}
            type="button"
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateEnvMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Saving...
              </span>
            ) : "Save"}
          </button>
        )}
      </div>
    </div>
  );
};

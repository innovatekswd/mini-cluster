import React, { useState, useEffect, type ChangeEvent, useRef } from "react";
import { EnvEditor, type EnvVar } from "./EnvEditor";
import type { ServiceFormData } from "~/types/Service";
import { throttle } from "../utils/throttle";

// Define the props type
export type ServiceConfigFormProps = {
  initialData?: ServiceFormData;
  onSubmit: (data: ServiceFormData) => Promise<void> | void;
  submitLabel: string;
  autoSave?: boolean; // New prop to enable auto-save
  header?: React.ReactNode; // Optional header to render above the form
};

export const ServiceConfigForm: React.FC<ServiceConfigFormProps> = ({
  initialData,
  onSubmit,
  submitLabel,
  autoSave = false, // Default to false for backward compatibility
  header,
}) => {
  const argsRef = useRef<HTMLTextAreaElement>(null);
  const envVarsRef = useRef<HTMLTextAreaElement>(null);
  const initialFormRef = useRef<string>(JSON.stringify(initialData || {}));
  const saveInProgressRef = useRef<boolean>(false);
  const activelyEditingRef = useRef<boolean>(false);

  const [formData, setFormData] = useState<ServiceFormData>(
    initialData || {
      name: "",
      executablePath: "",
      arguments: "",
      workingDirectory: "",
      environmentVariables: {},
      accessLink: "",
      isExternal: false,
      useShellExecute: false,
      createNoWindow: false,
      autoStart: false,
      captureOutput: 0,  // Auto (recommended)
    }
  );

  const [envVarsText, setEnvVarsText] = useState<string>(
    initialData && initialData.environmentVariables
      ? JSON.stringify(initialData.environmentVariables, null, 2)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [envVarsError, setEnvVarsError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle"
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Throttled save function to avoid too many save requests
  const autoSaveThrottled = useRef(
    throttle(async (data: ServiceFormData) => {
      if (!autoSave) return;
      try {
        saveInProgressRef.current = true;
        setSaveStatus("saving");

        // Clean environment variables before saving
        const cleanEnvVars = Object.entries(
          data.environmentVariables || {}
        ).reduce((acc, [key, value]) => {
          if (key.trim()) {
            acc[key.trim()] = value;
          }
          return acc;
        }, {} as Record<string, string>);

        const finalFormData: ServiceFormData = {
          ...data,
          environmentVariables: cleanEnvVars,
        };

        await onSubmit(finalFormData);

        // Update the reference of the "initial" state after successful save
        initialFormRef.current = JSON.stringify(finalFormData);
        setSaveStatus("saved");
        setHasChanges(false);

        // Reset status after a delay
        setTimeout(() => {
          setSaveStatus(currentStatus => {
            return currentStatus === "saved" ? "idle" : currentStatus;
          });
        }, 2000);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaveStatus("idle");
      } finally {
        saveInProgressRef.current = false;
      }
    }, 500) // Reduced delay since we're only triggering on blur events
  ).current;

  useEffect(() => {
    if (initialData) {
      // Only update form data if we're not currently saving or actively editing
      // This prevents the form from resetting while the user is editing
      if (!saveInProgressRef.current && !activelyEditingRef.current) {
        // Ensure captureOutput defaults to 0 if not present
        const dataWithDefaults = {
          ...initialData,
          captureOutput: initialData.captureOutput ?? 0,
        };
        setFormData(dataWithDefaults);
        setEnvVarsText(
          initialData.environmentVariables
            ? JSON.stringify(initialData.environmentVariables, null, 2)
            : ""
        );
        initialFormRef.current = JSON.stringify(dataWithDefaults);
      }
    }
  }, [initialData]);

  // Check for changes but DON'T auto-save on every change
  useEffect(() => {
    const currentFormJson = JSON.stringify(formData);
    const hasFormChanges = currentFormJson !== initialFormRef.current;
    setHasChanges(hasFormChanges);

    // No auto-save here - we'll only save on blur events
  }, [formData]);

  // Handle browser navigation prompt when there are unsaved changes
  useEffect(() => {
    if (!autoSave) return; // Only add this for auto-save mode

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && saveStatus !== "saving") {
        // This shows the standard "Leave Site?" dialog
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges, saveStatus, autoSave]);

  const handleChange = (field: keyof ServiceFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // No auto-save on change
  };

  // Track when user starts editing
  const handleFocus = () => {
    activelyEditingRef.current = true;
  };

  // Save on blur (when control loses focus)
  const handleBlur = () => {
    activelyEditingRef.current = false;
    // Save on blur when auto-save is enabled and there are changes
    if (autoSave && hasChanges) {
      autoSaveThrottled(formData);
    }
  };

  // Special handler for checkbox changes to save immediately on click
  // (since checkboxes don't typically have a blur event in the same way)
  const handleCheckboxChange = (field: keyof ServiceFormData, value: boolean) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    if (autoSave) {
      // Set flag immediately to prevent data sync during save
      saveInProgressRef.current = true;
      autoSaveThrottled(updatedData);
    }
  };

  const autoResizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    const computedHeight = Math.max(element.scrollHeight, 48);
    element.style.height = `${computedHeight}px`;
  };

  useEffect(() => {
    autoResizeTextarea(argsRef.current);
    autoResizeTextarea(envVarsRef.current);
  }, [formData.arguments, envVarsText]);

  const handleArgsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleChange("arguments", e.target.value);
    autoResizeTextarea(e.target);
    // No auto-save on change
  };

  // Standard form submit handler (for non-auto-save mode)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasChanges) {
      return; // No need to submit if there are no changes
    }

    setLoading(true);
    try {
      const cleanEnvVars = Object.entries(
        formData.environmentVariables || {}
      ).reduce((acc, [key, value]) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {} as Record<string, string>);
      const finalFormData: ServiceFormData = {
        ...formData,
        environmentVariables: cleanEnvVars,
      };
      await onSubmit(finalFormData);
      initialFormRef.current = JSON.stringify(finalFormData);
      setHasChanges(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update environment variables when EnvEditor changes
  const handleEnvVarsChange = (newVars: EnvVar[]) => {
    const envObject = newVars.reduce((acc, { key, value }) => {
      if (key.trim()) {
        acc[key.trim()] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    const updatedData = {
      ...formData,
      environmentVariables: envObject,
    };

    setFormData(updatedData);

    // For EnvEditor, we'll auto-save on changes since this component
    // has its own blur behavior internally
    if (autoSave && hasChanges) {
      autoSaveThrottled(updatedData);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="space-y-6"
    >
      {header && <div className="mb-4">{header}</div>}

      {/* Status indicator for auto-save */}
      {autoSave && saveStatus !== "idle" && (
        <div className="flex justify-end">
          {saveStatus === "saving" && (
            <span className="badge badge-warning">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mr-2"></span>
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="badge badge-success">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
              Saved
            </span>
          )}
        </div>
      )}

      {/* Service Name */}
      <div className="space-y-2">
        <label htmlFor="service-name" className="block text-sm font-medium text-slate-300">
          Service Name <span className="text-rose-400">*</span>
        </label>
        <input
          id="service-name"
          type="text"
          required
          placeholder="Enter service name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="input-field"
        />
      </div>

      {/* Executable Path */}
      <div className="space-y-2">
        <label htmlFor="exec-path" className="block text-sm font-medium text-slate-300">
          Executable Path <span className="text-rose-400">*</span>
        </label>
        <input
          id="exec-path"
          type="text"
          required
          placeholder="/path/to/executable"
          value={formData.executablePath}
          onChange={(e) => handleChange("executablePath", e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="input-field font-mono text-sm"
        />
      </div>

      {/* Arguments */}
      <div className="space-y-2">
        <label htmlFor="args" className="block text-sm font-medium text-slate-300">
          Arguments
        </label>
        <textarea
          ref={argsRef}
          id="args"
          placeholder="Command line arguments (optional)"
          value={formData.arguments}
          onChange={handleArgsChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="input-field font-mono text-sm resize-none"
          style={{ minHeight: "60px" }}
        />
      </div>

      {/* Working Directory */}
      <div className="space-y-2">
        <label htmlFor="working-directory" className="block text-sm font-medium text-slate-300">
          Working Directory
        </label>
        <input
          id="working-directory"
          type="text"
          placeholder="Defaults to executable's directory"
          value={formData.workingDirectory}
          onChange={(e) => handleChange("workingDirectory", e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="input-field font-mono text-sm"
        />
      </div>

      {/* Access Link */}
      <div className="space-y-2">
        <label htmlFor="access-link" className="block text-sm font-medium text-slate-300">
          Access Link
        </label>
        <input
          id="access-link"
          type="url"
          placeholder="https://example.com:8080"
          value={formData.accessLink || ""}
          onChange={(e) => handleChange("accessLink", e.target.value.trim())}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="input-field"
        />
        <p className="text-xs text-slate-500">URL to access the running service</p>
      </div>

      {/* Options Grid */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">Options</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* External Service */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={formData.isExternal || false}
              onChange={(e) => handleCheckboxChange("isExternal", e.target.checked)}
              className="checkbox-custom"
            />
            <div>
              <span className="text-sm text-slate-200">External Service</span>
              <p className="text-xs text-slate-500">Runs outside of this system</p>
            </div>
          </label>

          {/* Auto Start */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={formData.autoStart || false}
              onChange={(e) => handleCheckboxChange("autoStart", e.target.checked)}
              className="checkbox-custom"
            />
            <div>
              <span className="text-sm text-slate-200">Auto Start</span>
              <p className="text-xs text-slate-500">Start when system boots</p>
            </div>
          </label>

          {/* Shell Execute */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={formData.useShellExecute || false}
              onChange={(e) => handleCheckboxChange("useShellExecute", e.target.checked)}
              className="checkbox-custom"
            />
            <div>
              <span className="text-sm text-slate-200">Use Shell Execute</span>
              <p className="text-xs text-slate-500">Run via system shell</p>
            </div>
          </label>

          {/* Create No Window */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={formData.createNoWindow || false}
              onChange={(e) => handleCheckboxChange("createNoWindow", e.target.checked)}
              className="checkbox-custom"
            />
            <div>
              <span className="text-sm text-slate-200">No Window</span>
              <p className="text-xs text-slate-500">Run without visible window</p>
            </div>
          </label>
        </div>
      </div>

      {/* Capture Output */}
      <div className="space-y-2">
        <label htmlFor="capture-output" className="block text-sm font-medium text-slate-300">
          Log Capture
        </label>
        <select
          id="capture-output"
          value={formData.captureOutput ?? 0}
          onChange={(e) => {
            const captureValue = parseInt(e.target.value, 10);
            const updatedData = { ...formData, captureOutput: captureValue };
            setFormData(updatedData);
            if (autoSave) {
              saveInProgressRef.current = true;
              autoSaveThrottled(updatedData);
            }
          }}
          className="input-field"
        >
          <option value={0}>Auto (recommended)</option>
          <option value={1}>Always capture</option>
          <option value={2}>Never capture</option>
        </select>
        <p className="text-xs text-slate-500">
          {formData.captureOutput === 1
            ? "Always capture stdout/stderr (may fail with Shell Execute)"
            : formData.captureOutput === 2
            ? "Never capture logs from this service"
            : "Logs captured when Shell Execute is off, not captured when on"}
        </p>
      </div>

      {/* Environment Variables */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">
          Environment Variables
        </label>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <EnvEditor
            envVars={Object.entries(formData.environmentVariables || {}).map(([key, value]) => ({ key, value }))}
            onChange={handleEnvVarsChange}
            inline
          />
        </div>
      </div>
      
      {/* Submit Button */}
      {!autoSave && (
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !hasChanges}
            className={`
              w-full py-3 rounded-xl font-medium transition-all duration-200
              ${hasChanges 
                ? 'btn-success' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Saving...
              </span>
            ) : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
};

// Export aliases for backward compatibility during migration
export { ServiceConfigForm as AppConfigForm };
export type { ServiceConfigFormProps as AppConfigFormProps };

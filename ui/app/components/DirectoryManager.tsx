import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaTrash, FaEdit, FaHistory, FaCheck, FaTimes } from "react-icons/fa";
import { directoryService, type WatchedDirectory } from "../services/directoryService";
import { Modal } from "./Modal";

interface DirectoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewHistory?: (directoryId: string) => void;
}

interface DirectoryFormData {
  path: string;
  label: string;
  recursive: boolean;
  intervalSeconds: number;
}

const emptyForm: DirectoryFormData = {
  path: "",
  label: "",
  recursive: true,
  intervalSeconds: 60,
};

export function DirectoryManager({ isOpen, onClose, onViewHistory }: DirectoryManagerProps) {
  const [directories, setDirectories] = useState<WatchedDirectory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DirectoryFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchDirectories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dirs = await directoryService.list();
      setDirectories(dirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDirectories();
    }
  }, [isOpen, fetchDirectories]);

  const handleAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (dir: WatchedDirectory) => {
    setForm({
      path: dir.path,
      label: dir.label,
      recursive: dir.recursive,
      intervalSeconds: dir.interval_seconds,
    });
    setEditingId(dir.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this watched directory and all its snapshots?")) {
      return;
    }
    try {
      await directoryService.delete(id);
      setDirectories((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete directory");
    }
  };

  const handleSubmit = async () => {
    if (!form.path.trim()) {
      setError("Path is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await directoryService.update(editingId, {
          path: form.path,
          label: form.label,
          recursive: form.recursive,
          intervalSeconds: form.intervalSeconds,
        });
        setDirectories((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
      } else {
        const created = await directoryService.create({
          path: form.path,
          label: form.label,
          recursive: form.recursive,
          intervalSeconds: form.intervalSeconds,
        });
        setDirectories((prev) => [...prev, created]);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save directory");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (dir: WatchedDirectory) => {
    try {
      const updated = await directoryService.update(dir.id, { enabled: !dir.enabled });
      setDirectories((prev) => prev.map((d) => (d.id === dir.id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle directory");
    }
  };

  const formatSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let value = bytes;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Monitored Directories"
      size="xl"
    >
      <div className="space-y-4">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Manage directories being monitored for size and file count metrics.
          </p>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded text-sm hover:bg-cyan-500/30 transition-colors"
            aria-label="Add new directory to monitor"
          >
            <FaPlus className="text-xs" aria-hidden="true" />
            Add Directory
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-slate-200">
              {editingId ? "Edit Directory" : "Add New Directory"}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dirPath" className="block text-xs text-slate-400 mb-1">Path</label>
                <input
                  id="dirPath"
                  type="text"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="/var/log"
                  className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="dirLabel" className="block text-xs text-slate-400 mb-1">Label</label>
                <input
                  id="dirLabel"
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="App Logs"
                  className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="dirInterval" className="block text-xs text-slate-400 mb-1">Interval (seconds)</label>
                <input
                  id="dirInterval"
                  type="number"
                  value={form.intervalSeconds}
                  onChange={(e) => setForm({ ...form, intervalSeconds: parseInt(e.target.value) || 60 })}
                  min={10}
                  className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded text-sm text-slate-200"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.recursive}
                    onChange={(e) => setForm({ ...form, recursive: e.target.checked })}
                    className="rounded"
                  />
                  Recursive scan
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded text-sm hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                aria-label={submitting ? "Saving directory" : "Save directory"}
              >
                <FaCheck className="text-xs" aria-hidden="true" />
                {submitting ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 text-slate-400 border border-slate-600/50 rounded text-sm hover:bg-slate-700 transition-colors"
                aria-label="Cancel and close form"
              >
                <FaTimes className="text-xs" aria-hidden="true" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Directory Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
            <div className="text-slate-400">Loading directories...</div>
          </div>
        ) : directories.length === 0 ? (
          <div className="flex items-center justify-center py-8" aria-live="polite">
            <div className="text-slate-400 text-sm">No directories being monitored. Click "Add Directory" to start.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Watched directories">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase" scope="col">Path</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase" scope="col">Label</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-400 uppercase" scope="col">Recursive</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-400 uppercase" scope="col">Interval</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-400 uppercase" scope="col">Enabled</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {directories.map((dir) => (
                  <tr key={dir.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">{dir.path}</td>
                    <td className="px-4 py-2 text-slate-200">{dir.label || "—"}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={dir.recursive ? "text-green-400" : "text-slate-500"} aria-label={dir.recursive ? "Yes" : "No"}>
                        {dir.recursive ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-300">{dir.interval_seconds}s</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleToggleEnabled(dir)}
                        className={`px-2 py-0.5 rounded text-xs ${
                          dir.enabled
                            ? "bg-green-500/20 text-green-400"
                            : "bg-slate-600/30 text-slate-500"
                        }`}
                        aria-label={`${dir.enabled ? "Disable" : "Enable"} directory ${dir.path}`}
                        aria-pressed={dir.enabled}
                      >
                        {dir.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {onViewHistory && (
                          <button
                            onClick={() => onViewHistory(dir.id)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                            aria-label={`View history for ${dir.path}`}
                          >
                            <FaHistory className="text-xs" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(dir)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                          aria-label={`Edit directory ${dir.path}`}
                        >
                          <FaEdit className="text-xs" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(dir.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          aria-label={`Delete directory ${dir.path}`}
                        >
                          <FaTrash className="text-xs" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

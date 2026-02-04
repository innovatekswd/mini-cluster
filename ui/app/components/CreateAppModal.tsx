import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import type { CreateAppDto } from "~/types/App";
import { createAppSchema, validateForm, getFieldError } from "~/lib/validation";
import { getApiErrorMessage } from "~/lib/apiClient";

interface CreateAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAppDto) => Promise<void>;
}

// Common app emojis for selection
const EMOJI_OPTIONS = ["📦", "🚀", "🛒", "📊", "🔧", "🎨", "🎮", "📱", "💼", "🌐", "⚡", "🔒"];

// Preset colors for selection
const COLOR_OPTIONS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#6366f1", // Indigo
];

export function CreateAppModal({ isOpen, onClose, onSubmit }: CreateAppModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState("#3b82f6");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validate with Zod schema
    const validation = validateForm(createAppSchema, {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(validation.data as CreateAppDto);
      // Reset form and close on success
      setName("");
      setDescription("");
      setIcon("📦");
      setColor("#3b82f6");
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create app"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Create New App</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                getFieldError(fieldErrors, "name") 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                  : "border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
              }`}
              disabled={submitting}
              autoFocus
              aria-describedby={getFieldError(fieldErrors, "name") ? "name-error" : undefined}
              aria-invalid={!!getFieldError(fieldErrors, "name")}
            />
            {getFieldError(fieldErrors, "name") && (
              <p id="name-error" className="mt-1 text-sm text-red-400">{getFieldError(fieldErrors, "name")}</p>
            )}
          </div>

          {/* Description field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this app..."
              rows={2}
              className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-1 resize-none ${
                getFieldError(fieldErrors, "description") 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                  : "border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
              }`}
              disabled={submitting}
              aria-describedby={getFieldError(fieldErrors, "description") ? "description-error" : undefined}
              aria-invalid={!!getFieldError(fieldErrors, "description")}
            />
            {getFieldError(fieldErrors, "description") && (
              <p id="description-error" className="mt-1 text-sm text-red-400">{getFieldError(fieldErrors, "description")}</p>
            )}
          </div>

          {/* Icon selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    icon === emoji
                      ? "bg-cyan-500/30 border-2 border-cyan-500 scale-110"
                      : "bg-slate-700 hover:bg-slate-600 border border-transparent"
                  }`}
                  disabled={submitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Preview
            </label>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${color}20` }}
                >
                  {icon}
                </div>
                <div>
                  <div className="font-medium text-white">
                    {name || "App Name"}
                  </div>
                  {description && (
                    <div className="text-sm text-slate-400 line-clamp-1">
                      {description}
                    </div>
                  )}
                </div>
              </div>
              <div
                className="h-1 rounded-full mt-3"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create App"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

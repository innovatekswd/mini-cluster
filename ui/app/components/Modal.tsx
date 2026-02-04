import React, { useEffect, useCallback } from "react";
import { FaTimes } from "react-icons/fa";

interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal title shown in header */
  title: string;
  /** Modal content */
  children: React.ReactNode;
  /** Modal width - default is "md" (max-w-md) */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Whether clicking backdrop closes modal - default true */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes modal - default true */
  closeOnEscape?: boolean;
  /** Whether to show close button in header - default true */
  showCloseButton?: boolean;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Whether close button is disabled (e.g., during form submission) */
  disableClose?: boolean;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer,
  disableClose = false,
}: ModalProps) {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && !disableClose) {
        onClose();
      }
    },
    [closeOnEscape, disableClose, onClose]
  );

  // Add/remove event listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdrop && !disableClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        className={`relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full ${SIZE_CLASSES[size]} mx-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 id="modal-title" className="text-xl font-semibold text-white">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              disabled={disableClose}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <FaTimes size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4">{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standard modal action buttons for convenience
 */
interface ModalActionsProps {
  onCancel: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  confirmVariant?: "primary" | "danger";
}

export function ModalActions({
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  isLoading = false,
  disabled = false,
  confirmVariant = "primary",
}: ModalActionsProps) {
  const confirmClasses =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-cyan-600 hover:bg-cyan-500";

  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled || isLoading}
          className={`px-4 py-2 rounded-lg ${confirmClasses} text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? "..." : confirmLabel}
        </button>
      )}
    </>
  );
}

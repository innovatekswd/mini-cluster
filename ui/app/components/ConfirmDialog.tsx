import React, { useState, createContext, useContext, useCallback } from "react";
import { FaExclamationTriangle, FaTrash, FaQuestionCircle } from "react-icons/fa";
import { Modal, ModalActions } from "./Modal";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Confirm button text */
  confirmLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Dialog style variant */
  variant?: ConfirmVariant;
}

interface ConfirmContextType {
  /**
   * Show a confirmation dialog and return a promise.
   * Resolves to true if user confirmed, false if cancelled.
   */
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

/**
 * Hook to access confirmation dialog functionality.
 * Must be used within ConfirmProvider.
 */
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}

interface ConfirmState extends ConfirmDialogOptions {
  resolver: (value: boolean) => void;
}

const VARIANT_CONFIGS: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmVariant: "primary" | "danger";
}> = {
  danger: {
    icon: <FaTrash className="text-red-400" size={24} />,
    iconBg: "bg-red-500/10",
    confirmVariant: "danger",
  },
  warning: {
    icon: <FaExclamationTriangle className="text-amber-400" size={24} />,
    iconBg: "bg-amber-500/10",
    confirmVariant: "primary",
  },
  info: {
    icon: <FaQuestionCircle className="text-cyan-400" size={24} />,
    iconBg: "bg-cyan-500/10",
    confirmVariant: "primary",
  },
};

/**
 * Provider component for confirmation dialogs.
 * Wrap your app with this to enable useConfirm hook.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolver: resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolver(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolver(false);
    setState(null);
  };

  const variantConfig = state ? VARIANT_CONFIGS[state.variant || "info"] : VARIANT_CONFIGS.info;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      <Modal
        isOpen={!!state}
        onClose={handleCancel}
        title={state?.title || ""}
        size="sm"
        showCloseButton={false}
        footer={
          <ModalActions
            onCancel={handleCancel}
            onConfirm={handleConfirm}
            cancelLabel={state?.cancelLabel || "Cancel"}
            confirmLabel={state?.confirmLabel || "Confirm"}
            confirmVariant={variantConfig.confirmVariant}
          />
        }
      >
        <div className="flex gap-4">
          <div className={`flex-shrink-0 rounded-full p-3 ${variantConfig.iconBg}`}>
            {variantConfig.icon}
          </div>
          <div>
            <p className="text-slate-300">{state?.message}</p>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * Preset confirmation dialogs for common scenarios.
 */
export const confirmPresets = {
  /**
   * Confirmation for deleting an item
   */
  delete: (itemName: string): ConfirmDialogOptions => ({
    title: "Delete Item",
    message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    variant: "danger",
  }),

  /**
   * Confirmation for unsaved changes
   */
  unsavedChanges: (): ConfirmDialogOptions => ({
    title: "Unsaved Changes",
    message: "You have unsaved changes. Are you sure you want to leave?",
    confirmLabel: "Leave",
    cancelLabel: "Stay",
    variant: "warning",
  }),

  /**
   * Confirmation for destructive actions
   */
  destructive: (action: string): ConfirmDialogOptions => ({
    title: "Confirm Action",
    message: `Are you sure you want to ${action}? This action cannot be undone.`,
    confirmLabel: "Continue",
    cancelLabel: "Cancel",
    variant: "danger",
  }),
};

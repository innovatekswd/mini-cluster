import { useEffect, useCallback } from 'react';
import type { FileItem } from '~/services/explorerService';

interface KeyboardShortcutsOptions {
  selectedItems: Set<string>;
  previewItem: FileItem | null;
  currentPath: string;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: () => void;
  onRefresh: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
  onNavigateUp: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  selectedItems,
  previewItem,
  currentPath,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onRefresh,
  onNewFile,
  onNewFolder,
  onUpload,
  onSelectAll,
  onEscape,
  onNavigateUp,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts when in input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't handle if disabled
      if (!enabled) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Delete - Delete key
      if (e.key === 'Delete' && selectedItems.size > 0) {
        e.preventDefault();
        onDelete();
        return;
      }

      // Rename - F2
      if (e.key === 'F2' && selectedItems.size === 1) {
        e.preventDefault();
        onRename();
        return;
      }

      // Refresh - F5 or Ctrl+R
      if (e.key === 'F5' || (isCtrlOrCmd && e.key === 'r')) {
        e.preventDefault();
        onRefresh();
        return;
      }

      // Copy - Ctrl+C
      if (isCtrlOrCmd && e.key === 'c' && selectedItems.size > 0) {
        e.preventDefault();
        onCopy();
        return;
      }

      // Cut - Ctrl+X
      if (isCtrlOrCmd && e.key === 'x' && selectedItems.size > 0) {
        e.preventDefault();
        onCut();
        return;
      }

      // Paste - Ctrl+V
      if (isCtrlOrCmd && e.key === 'v') {
        e.preventDefault();
        onPaste();
        return;
      }

      // Select All - Ctrl+A
      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // New File - Ctrl+N
      if (isCtrlOrCmd && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        onNewFile();
        return;
      }

      // New Folder - Ctrl+Shift+N
      if (isCtrlOrCmd && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        onNewFolder();
        return;
      }

      // Upload - Ctrl+U
      if (isCtrlOrCmd && e.key === 'u') {
        e.preventDefault();
        onUpload();
        return;
      }

      // Escape - close preview/context menu
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
        return;
      }

      // Backspace - navigate up
      if (e.key === 'Backspace' && currentPath) {
        e.preventDefault();
        onNavigateUp();
        return;
      }
    },
    [
      selectedItems,
      previewItem,
      currentPath,
      enabled,
      onDelete,
      onCopy,
      onCut,
      onPaste,
      onRename,
      onRefresh,
      onNewFile,
      onNewFolder,
      onUpload,
      onSelectAll,
      onEscape,
      onNavigateUp,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Shortcut definitions for help display
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Delete'], description: 'Delete selected items' },
  { keys: ['F2'], description: 'Rename selected item' },
  { keys: ['F5'], description: 'Refresh' },
  { keys: ['Ctrl', 'C'], description: 'Copy' },
  { keys: ['Ctrl', 'X'], description: 'Cut' },
  { keys: ['Ctrl', 'V'], description: 'Paste' },
  { keys: ['Ctrl', 'A'], description: 'Select all' },
  { keys: ['Ctrl', 'N'], description: 'New file' },
  { keys: ['Ctrl', 'Shift', 'N'], description: 'New folder' },
  { keys: ['Ctrl', 'U'], description: 'Upload' },
  { keys: ['Escape'], description: 'Close panel / Deselect' },
  { keys: ['Backspace'], description: 'Navigate up' },
];

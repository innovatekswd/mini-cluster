/**
 * Reusable keyboard navigation hooks
 * 
 * Provides keyboard shortcuts for common UI patterns like list navigation,
 * modal handling, and action shortcuts.
 */
import { useEffect, useCallback, useRef } from "react";

interface KeyboardNavigationOptions {
  /**
   * Enable/disable the keyboard handler
   */
  enabled?: boolean;
  
  /**
   * Prevent default browser behavior for handled keys
   */
  preventDefault?: boolean;
  
  /**
   * Stop propagation of handled events
   */
  stopPropagation?: boolean;
  
  /**
   * Ignore events when focused on input elements
   */
  ignoreInputs?: boolean;
}

const DEFAULT_OPTIONS: KeyboardNavigationOptions = {
  enabled: true,
  preventDefault: true,
  stopPropagation: false,
  ignoreInputs: true,
};

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

/**
 * Hook for list navigation with arrow keys
 */
export function useListNavigation<T extends { id: string }>(
  items: T[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  options: KeyboardNavigationOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  useEffect(() => {
    if (!opts.enabled || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (opts.ignoreInputs && isInputElement(e.target)) return;

      const currentIndex = selectedId
        ? items.findIndex((item) => item.id === selectedId)
        : -1;

      let newIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowUp":
        case "k":
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
        case "Home":
          newIndex = 0;
          break;
        case "End":
          newIndex = items.length - 1;
          break;
      }

      if (newIndex !== null) {
        if (opts.preventDefault) e.preventDefault();
        if (opts.stopPropagation) e.stopPropagation();
        onSelect(items[newIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedId, onSelect, opts]);
}

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

/**
 * Hook for custom keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: KeyboardNavigationOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!opts.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (opts.ignoreInputs && isInputElement(e.target)) return;

      const matchingShortcut = shortcutsRef.current.find((shortcut) => {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : true;
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        // More precise matching for modifier keys
        if (shortcut.ctrl || shortcut.meta) {
          return keyMatch && (e.ctrlKey || e.metaKey) && shiftMatch && altMatch;
        }
        
        return keyMatch && !e.ctrlKey && !e.metaKey && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        if (opts.preventDefault) e.preventDefault();
        if (opts.stopPropagation) e.stopPropagation();
        matchingShortcut.action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [opts]);
}

/**
 * Hook for escape key handling (closing modals, dialogs, etc.)
 */
export function useEscapeKey(
  onEscape: () => void,
  options: KeyboardNavigationOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ignoreInputs: false, ...options };

  useEffect(() => {
    if (!opts.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (opts.preventDefault) e.preventDefault();
        if (opts.stopPropagation) e.stopPropagation();
        onEscape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, opts]);
}

/**
 * Hook for Enter key handling (confirming actions)
 */
export function useEnterKey(
  onEnter: () => void,
  options: KeyboardNavigationOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  useEffect(() => {
    if (!opts.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (opts.ignoreInputs && isInputElement(e.target)) return;

      if (e.key === "Enter") {
        if (opts.preventDefault) e.preventDefault();
        if (opts.stopPropagation) e.stopPropagation();
        onEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEnter, opts]);
}

/**
 * Hook for focus trap (keeps focus within a container)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    
    // Focus first element on mount
    firstElement?.focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled]);
}

/**
 * Get display string for a keyboard shortcut
 */
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(navigator.platform.includes("Mac") ? "⌘" : "Ctrl");
  }
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");
  
  // Format key display
  let keyDisplay = shortcut.key;
  if (keyDisplay === "ArrowUp") keyDisplay = "↑";
  else if (keyDisplay === "ArrowDown") keyDisplay = "↓";
  else if (keyDisplay === "ArrowLeft") keyDisplay = "←";
  else if (keyDisplay === "ArrowRight") keyDisplay = "→";
  else if (keyDisplay === " ") keyDisplay = "Space";
  else keyDisplay = keyDisplay.toUpperCase();
  
  parts.push(keyDisplay);
  
  return parts.join(" + ");
}

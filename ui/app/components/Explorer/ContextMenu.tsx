import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  FaFolderOpen,
  FaTerminal,
  FaEdit,
  FaFile,
  FaCopy,
  FaCut,
  FaDownload,
  FaEllipsisV,
  FaTrash,
  FaArchive,
  FaFileArchive,
} from 'react-icons/fa';
import { isEditable, isPreviewable, isArchive, type FileItem } from '~/services/explorerService';

interface ContextMenuProps {
  x: number;
  y: number;
  item: FileItem | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

interface MenuItem {
  action: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  show?: boolean;
}

/**
 * Context menu component with keyboard navigation support
 */
export const ContextMenu = React.memo<ContextMenuProps>(({ x, y, item, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Build menu items based on file type
  const menuItems: MenuItem[] = React.useMemo(() => {
    if (!item) return [];
    
    const items: MenuItem[] = [];
    
    if (item.type === 'directory') {
      items.push(
        { action: 'open', label: 'Open', icon: <FaFolderOpen /> },
        { action: 'terminal', label: 'Open Terminal Here', icon: <FaTerminal /> }
      );
    } else {
      if (isEditable(item)) {
        items.push({ action: 'edit', label: 'Edit', icon: <FaEdit /> });
      }
      if (isPreviewable(item)) {
        items.push({ action: 'preview', label: 'Preview', icon: <FaFile /> });
      }
    }
    
    items.push(
      { action: 'separator-1', label: '', icon: null },
      { action: 'copy', label: 'Copy', icon: <FaCopy /> },
      { action: 'cut', label: 'Cut', icon: <FaCut /> },
      { action: 'rename', label: 'Rename', icon: <FaEdit /> },
      { action: 'separator-2', label: '', icon: null },
    );

    // Archive actions
    if (isArchive(item)) {
      items.push(
        { action: 'extract', label: 'Extract...', icon: <FaFileArchive /> },
        { action: 'archive-contents', label: 'Browse Archive', icon: <FaArchive /> },
      );
    }
    items.push(
      { action: 'compress', label: 'Compress...', icon: <FaArchive /> },
      { action: 'separator-3', label: '', icon: null },
    );
    
    items.push(
      { action: 'download', label: 'Download', icon: <FaDownload /> },
      { action: 'properties', label: 'Properties', icon: <FaEllipsisV /> },
      { action: 'separator-4', label: '', icon: null },
      { action: 'delete', label: 'Delete', icon: <FaTrash />, danger: true }
    );
    
    return items;
  }, [item]);

  // Filter out separators for navigation
  const actionItems = menuItems.filter(m => !m.action.startsWith('separator'));

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % actionItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + actionItems.length) % actionItems.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onAction(actionItems[focusedIndex].action);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(actionItems.length - 1);
        break;
    }
  }, [actionItems, focusedIndex, onAction, onClose]);

  // Focus menu on mount
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  if (!item) return null;

  // Adjust position to stay within viewport
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200;
    const menuHeight = menuItems.length * 36;
    const padding = 10;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (typeof window !== 'undefined') {
      if (x + menuWidth > window.innerWidth - padding) {
        adjustedX = window.innerWidth - menuWidth - padding;
      }
      if (y + menuHeight > window.innerHeight - padding) {
        adjustedY = window.innerHeight - menuHeight - padding;
      }
    }
    
    return { x: adjustedX, y: adjustedY };
  }, [x, y, menuItems.length]);

  let actionIndex = -1;

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Context menu"
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 min-w-[180px] focus:outline-none"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      onKeyDown={handleKeyDown}
    >
      {menuItems.map((menuItem, index) => {
        if (menuItem.action.startsWith('separator')) {
          return <div key={menuItem.action} className="border-t border-slate-700 my-1" role="separator" />;
        }
        
        actionIndex++;
        const currentActionIndex = actionIndex;
        const isFocused = currentActionIndex === focusedIndex;
        
        return (
          <button
            key={menuItem.action}
            role="menuitem"
            onClick={() => onAction(menuItem.action)}
            onMouseEnter={() => setFocusedIndex(currentActionIndex)}
            className={`
              w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors
              ${menuItem.danger 
                ? 'text-rose-400 hover:bg-rose-500/10' 
                : 'text-slate-300 hover:bg-slate-700/50'
              }
              ${isFocused ? (menuItem.danger ? 'bg-rose-500/10' : 'bg-slate-700/50') : ''}
            `}
            aria-label={menuItem.label}
          >
            <span className="w-4" aria-hidden="true">{menuItem.icon}</span>
            {menuItem.label}
          </button>
        );
      })}
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;

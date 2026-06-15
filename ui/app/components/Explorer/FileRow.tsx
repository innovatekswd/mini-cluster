import React from 'react';
import { FileIcon } from './FileIcon';
import { formatFileSize, formatDate, type FileItem } from '~/services/explorerService';
import type { ColumnWidths } from './hooks/useColumnResize';

interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
  isCut?: boolean;
  onSelect: (item: FileItem, multi: boolean) => void;
  onOpen: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  cols: ColumnWidths;
}

/**
 * File list row component - displays a single file/folder item
 * Memoized to prevent unnecessary re-renders in large lists
 */
export const FileRow = React.memo<FileRowProps>(({
  item,
  isSelected,
  isCut,
  onSelect,
  onOpen,
  onContextMenu,
  cols,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    onSelect(item, e.ctrlKey || e.metaKey);
  };

  const handleDoubleClick = () => {
    onOpen(item);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    onContextMenu(e, item);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onOpen(item);
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelect(item, e.ctrlKey || e.metaKey);
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
      className={`
        flex items-center gap-3 px-3 py-2 cursor-pointer select-none
        border-b border-slate-800/50 hover:bg-slate-800/30
        ${isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : ''}
        ${isCut ? 'opacity-50' : ''}
        transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-inset
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <FileIcon item={item} />
      
      <div className="flex-1 min-w-0" role="cell">
        <span className="block truncate text-sm">{item.name}</span>
      </div>

      <div className="shrink-0 text-xs text-slate-500 text-right" style={{ width: cols.size }} role="cell">
        {item.type === 'file' ? formatFileSize(item.size) : `${item.itemCount ?? '-'} items`}
      </div>

      <div className="shrink-0 text-xs text-slate-500 text-right hidden md:block" style={{ width: cols.modified }} role="cell">
        {formatDate(item.modified)}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.path === nextProps.item.path &&
    prevProps.item.modified === nextProps.item.modified &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isCut === nextProps.isCut &&
    prevProps.cols.size === nextProps.cols.size &&
    prevProps.cols.modified === nextProps.cols.modified
  );
});

FileRow.displayName = 'FileRow';

export default FileRow;

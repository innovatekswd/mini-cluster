import React, { useState, useEffect, useRef } from 'react';
import { FaChevronRight, FaHome, FaEdit } from 'react-icons/fa';
import type { FileItem } from '~/services/explorerService';

interface AddressBarProps {
  path: string;
  onNavigate: (path: string) => void;
  roots: FileItem[];
}

/**
 * Breadcrumb/Address bar component for file path navigation
 * Supports both click-to-navigate and direct path editing
 */
export const AddressBar = React.memo<AddressBarProps>(({ path, onNavigate, roots }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);
  const parts = path.split('/').filter(Boolean);

  useEffect(() => {
    setEditValue(path);
  }, [path]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== path) {
      onNavigate(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(path);
      setIsEditing(false);
    }
  };

  // Editable mode
  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('')}
          className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          title="Home"
          aria-label="Navigate to home"
        >
          <FaHome aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { setEditValue(path); setIsEditing(false); }}
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-cyan-500 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          placeholder="Enter path..."
          aria-label="File path"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm rounded-lg transition-colors"
        >
          Go
        </button>
      </form>
    );
  }

  // Breadcrumb mode
  return (
    <nav 
      className="flex items-center gap-1 text-sm overflow-x-auto py-2 px-1 cursor-text group"
      onClick={() => setIsEditing(true)}
      title="Click to edit path"
      aria-label="File path breadcrumb"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate(''); }}
        className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        title="Home"
        aria-label="Navigate to home"
      >
        <FaHome aria-hidden="true" />
      </button>
      
      {parts.length === 0 ? (
        <span className="text-slate-500 px-2">Click to enter path...</span>
      ) : (
        parts.map((part, index) => {
          const pathUpToHere = '/' + parts.slice(0, index + 1).join('/');
          const isLast = index === parts.length - 1;
          
          return (
            <React.Fragment key={pathUpToHere}>
              <FaChevronRight className="text-slate-600 text-xs flex-shrink-0" aria-hidden="true" />
              <button
                onClick={(e) => { e.stopPropagation(); !isLast && onNavigate(pathUpToHere); }}
                className={`px-2 py-1 rounded truncate max-w-[150px] ${
                  isLast
                    ? 'text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                } transition-colors`}
                disabled={isLast}
                title={part}
                aria-current={isLast ? 'page' : undefined}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })
      )}
      
      {/* Edit indicator */}
      <FaEdit className="text-slate-600 text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" aria-hidden="true" />
    </nav>
  );
});

AddressBar.displayName = 'AddressBar';

export default AddressBar;

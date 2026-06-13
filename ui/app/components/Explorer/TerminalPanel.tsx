import React, { useEffect, useState } from 'react';
import { FaTimes, FaTerminal, FaExpand, FaCompress } from 'react-icons/fa';

interface TerminalPanelProps {
  workingDirectory: string;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

type TerminalComponentType = typeof import("~/components/Terminal").Terminal;

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  workingDirectory,
  onClose,
  isMaximized = false,
  onToggleMaximize,
}) => {
  const [TerminalComponent, setTerminalComponent] = useState<TerminalComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTerminal = async () => {
      try {
        setLoadError(null);
        const mod = await import("~/components/Terminal");
        if (!cancelled) {
          setTerminalComponent(() => mod.Terminal);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load terminal module:", error);
          setLoadError("Terminal failed to load.");
        }
      }
    };

    loadTerminal();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`flex flex-col bg-slate-900 border-t border-slate-700 ${
      isMaximized ? 'fixed inset-0 z-50' : 'h-80'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FaTerminal className="text-green-400" />
          <span className="text-sm font-medium text-slate-300">Terminal</span>
          <span className="text-xs text-slate-500 truncate max-w-[300px]">
            {workingDirectory}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <FaCompress className="text-slate-400 text-sm" />
              ) : (
                <FaExpand className="text-slate-400 text-sm" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title="Close"
          >
            <FaTimes className="text-slate-400 text-sm" />
          </button>
        </div>
      </div>
      
      {/* Terminal */}
      <div className="flex-1 min-h-0">
        {loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {loadError}
          </div>
        ) : TerminalComponent ? (
          <TerminalComponent
            workingDirectory={workingDirectory}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading terminal...
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;

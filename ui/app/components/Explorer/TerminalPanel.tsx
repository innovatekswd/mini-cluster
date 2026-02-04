import React from 'react';
import { FaTimes, FaTerminal, FaExpand, FaCompress } from 'react-icons/fa';
import { Terminal } from '~/components/Terminal';

interface TerminalPanelProps {
  workingDirectory: string;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  workingDirectory,
  onClose,
  isMaximized = false,
  onToggleMaximize,
}) => {
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
        <Terminal 
          workingDirectory={workingDirectory}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default TerminalPanel;

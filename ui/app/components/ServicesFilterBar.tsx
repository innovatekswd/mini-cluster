import { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaCheck, FaTimes, FaThList, FaSitemap } from "react-icons/fa";
import type { AppWithStats } from "~/types/App";

interface ServicesFilterBarProps {
  apps: AppWithStats[];
  selectedAppIds: string[];
  viewMode: 'tree' | 'flat';
  onAppFilterChange: (appIds: string[]) => void;
  onViewModeChange: (mode: 'tree' | 'flat') => void;
}

export function ServicesFilterBar({
  apps,
  selectedAppIds,
  viewMode,
  onAppFilterChange,
  onViewModeChange,
}: ServicesFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleApp = (appId: string) => {
    if (selectedAppIds.includes(appId)) {
      onAppFilterChange(selectedAppIds.filter(id => id !== appId));
    } else {
      onAppFilterChange([...selectedAppIds, appId]);
    }
  };

  const handleSelectAll = () => {
    onAppFilterChange(apps.map(app => app.id));
  };

  const handleClearAll = () => {
    onAppFilterChange([]);
  };

  const isAllSelected = selectedAppIds.length === apps.length;
  const displayText = isAllSelected
    ? "All Apps"
    : selectedAppIds.length === 0
    ? "No Apps Selected"
    : `${selectedAppIds.length} ${selectedAppIds.length === 1 ? 'App' : 'Apps'} Selected`;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
      {/* App Filter Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
        >
          <span className="text-sm text-slate-300">{displayText}</span>
          <FaChevronDown className={`text-xs text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full mt-2 left-0 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
            {/* Header with actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-white">Filter by App</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Apps List */}
            <div className="max-h-96 overflow-y-auto">
              {apps.map((app) => {
                const isSelected = selectedAppIds.includes(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => handleToggleApp(app.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 transition-colors
                      ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}
                    `}
                  >
                    {/* Checkbox */}
                    <div className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'}
                    `}>
                      {isSelected && <FaCheck className="text-white text-xs" />}
                    </div>

                    {/* App Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: `${app.color || '#3b82f6'}20` }}
                    >
                      {app.icon || '📦'}
                    </div>

                    {/* App Info */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-white">{app.name}</div>
                      <div className="text-xs text-slate-500">
                        {app.serviceCount} {app.serviceCount === 1 ? 'service' : 'services'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Apps Pills */}
            {selectedAppIds.length > 0 && selectedAppIds.length < apps.length && (
              <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30">
                <div className="flex flex-wrap gap-2">
                  {selectedAppIds.map((appId) => {
                    const app = apps.find(a => a.id === appId);
                    if (!app) return null;
                    return (
                      <div
                        key={appId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-700/50 text-xs"
                      >
                        <span>{app.icon || '📦'}</span>
                        <span className="text-slate-300">{app.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleApp(appId);
                          }}
                          className="ml-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <FaTimes size={8} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('tree')}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${viewMode === 'tree'
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
            }
          `}
          title="Grouped by App"
        >
          <FaSitemap className="w-3.5 h-3.5" />
          <span>Grouped</span>
        </button>
        <button
          onClick={() => onViewModeChange('flat')}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${viewMode === 'flat'
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
            }
          `}
          title="Flat List"
        >
          <FaThList className="w-3.5 h-3.5" />
          <span>Flat</span>
        </button>
      </div>
    </div>
  );
}

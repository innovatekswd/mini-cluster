import { useRef } from "react";
import type { AppWithStats } from "~/types/App";

interface AppFilterProps {
  apps: AppWithStats[];
  selectedAppIds: string[];
  onAppFilterChange: (appIds: string[]) => void;
}

export function AppFilter({ apps, selectedAppIds, onAppFilterChange }: AppFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePillClick = (appId: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Ctrl/Cmd click: toggle this app in/out of multi-selection
      if (selectedAppIds.includes(appId)) {
        onAppFilterChange(selectedAppIds.filter(id => id !== appId));
      } else {
        onAppFilterChange([...selectedAppIds, appId]);
      }
    } else {
      // Normal click: exclusive select, or deselect if already the only one selected
      if (selectedAppIds.length === 1 && selectedAppIds[0] === appId) {
        onAppFilterChange([]);
      } else {
        onAppFilterChange([appId]);
      }
    }
  };

  if (apps.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {apps.map((app) => {
        const isSelected = selectedAppIds.includes(app.id);
        const isSoleSelection = selectedAppIds.length === 1 && isSelected;
        const isMulti = selectedAppIds.length > 1 && isSelected;

        return (
          <button
            key={app.id}
            onClick={(e) => handlePillClick(app.id, e)}
            title={`${app.name} · ${app.serviceCount} service${app.serviceCount !== 1 ? "s" : ""}${"\n"}Ctrl+click to multi-select`}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
              whitespace-nowrap flex-shrink-0 transition-all duration-150
              ${isSelected
                ? "text-white border border-transparent shadow-sm"
                : "text-slate-400 bg-slate-800/40 border border-slate-700/50 hover:text-slate-200 hover:bg-slate-800/70 hover:border-slate-600/50"
              }
            `}
            style={isSelected ? {
              backgroundColor: `${app.color || "#3b82f6"}25`,
              borderColor: `${app.color || "#3b82f6"}60`,
              color: app.color || "#60a5fa",
            } : undefined}
          >
            <span className="text-base leading-none">{app.icon || "📦"}</span>
            <span>{app.name}</span>
            {/* Running count dot */}
            {app.runningCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"
                title={`${app.runningCount} running`}
              />
            )}
            {app.failedCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"
                title={`${app.failedCount} failed`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

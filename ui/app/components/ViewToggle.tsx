import React from "react";
import { FaServer, FaCubes } from "react-icons/fa";
import type { ViewMode } from "~/types/Phase5Types";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  machineCount?: number;
  appCount?: number;
}

export function ViewToggle({ view, onChange, machineCount, appCount }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <button
        onClick={() => onChange("services")}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
          ${view === "services"
            ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          }
        `}
      >
        <FaCubes className="w-4 h-4" />
        <span>Services</span>
        {appCount !== undefined && (
          <span className={`
            px-1.5 py-0.5 rounded text-xs font-semibold
            ${view === "services" ? "bg-white/20" : "bg-slate-700 text-slate-400"}
          `}>
            {appCount}
          </span>
        )}
      </button>
      
      <button
        onClick={() => onChange("machines")}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
          ${view === "machines"
            ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          }
        `}
      >
        <FaServer className="w-4 h-4" />
        <span>Machines</span>
        {machineCount !== undefined && (
          <span className={`
            px-1.5 py-0.5 rounded text-xs font-semibold
            ${view === "machines" ? "bg-white/20" : "bg-slate-700 text-slate-400"}
          `}>
            {machineCount}
          </span>
        )}
      </button>
    </div>
  );
}

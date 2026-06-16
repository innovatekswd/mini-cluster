import React from "react";
import { Link } from "react-router";
import type { Service } from "~/types/Service";
import { HistoryTab } from "./HistoryTab";
import { FaExternalLinkAlt } from "react-icons/fa";

interface AppHistoryTabProps {
  services: Service[];
  onSelectService?: (serviceId: string) => void;
}

export function AppHistoryTab({ services, onSelectService }: AppHistoryTabProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <span className="text-xs text-slate-500">
          Historical metrics scoped to this app's services
        </span>
        <Link
          to="/inspect/local/history"
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <FaExternalLinkAlt size={10} />
          Full History in Inspect
        </Link>
      </div>
      <div className="flex-1 min-h-0">
        <HistoryTab onSelectService={onSelectService} />
      </div>
    </div>
  );
}

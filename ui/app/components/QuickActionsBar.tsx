import React from "react";
import { Link } from "react-router";
import {
  FaFolderOpen,
  FaTerminal,
  FaChartBar,
  FaChartLine,
  FaCogs,
  FaStream,
  FaClock,
  FaGlobe,
} from "react-icons/fa";

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  link: string;
  color: string;
  description: string;
}

// ============================================================================
// Actions Configuration
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Files",
    icon: <FaFolderOpen />,
    link: "/explorer",
    color: "text-amber-400",
    description: "Browse filesystem",
  },
  {
    label: "Terminal",
    icon: <FaTerminal />,
    link: "/terminal",
    color: "text-emerald-400",
    description: "Open terminal session",
  },
  {
    label: "Resources",
    icon: <FaChartBar />,
    link: "/machines/local/resources",
    color: "text-cyan-400",
    description: "View resource metrics",
  },
  {
    label: "Analytics",
    icon: <FaChartLine />,
    link: "/analytics",
    color: "text-violet-400",
    description: "Historical data exploration",
  },
  {
    label: "Services",
    icon: <FaCogs />,
    link: "/services",
    color: "text-blue-400",
    description: "Manage services",
  },
  {
    label: "Logs",
    icon: <FaStream />,
    link: "/machines/local/logs",
    color: "text-rose-400",
    description: "View machine logs",
  },
  {
    label: "Automation",
    icon: <FaClock />,
    link: "/automation",
    color: "text-orange-400",
    description: "Cron jobs & tasks",
  },
  {
    label: "Proxy",
    icon: <FaGlobe />,
    link: "/proxy",
    color: "text-teal-400",
    description: "Reverse proxy rules",
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const QuickActionsBar: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <Link
          key={action.label}
          to={action.link}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50 transition-all group"
          title={action.description}
        >
          <span className={`${action.color} text-sm`}>{action.icon}</span>
          <span className="text-sm text-slate-300 group-hover:text-slate-100">
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
};

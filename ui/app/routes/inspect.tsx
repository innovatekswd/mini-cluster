import React from "react";
import { Link, Outlet, useLocation, useParams, useNavigate } from "react-router";
import {
  FaTachometerAlt,
  FaFolderOpen,
  FaList,
  FaTerminal,
  FaServer,
  FaHistory,
  FaBolt,
} from "react-icons/fa";

interface InspectTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  description: string;
}

const TAB_DEFINITIONS: Omit<InspectTab, "path">[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <FaTachometerAlt />,
    description: "Real-time operations overview",
  },
  {
    id: "files",
    label: "Explorer",
    icon: <FaFolderOpen />,
    description: "File Explorer",
  },
  {
    id: "processes",
    label: "Processes",
    icon: <FaList />,
    description: "Process manager",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: <FaTerminal />,
    description: "Terminal session",
  },
  {
    id: "history",
    label: "History",
    icon: <FaHistory />,
    description: "Historical metrics",
  },
  {
    id: "events",
    label: "Events",
    icon: <FaBolt />,
    description: "System events log",
  },
];

/**
 * Build tab paths dynamically based on the current machineId.
 * Falls back to "local" if no machineId is provided.
 */
function useInspectTabs(): InspectTab[] {
  const { machineId } = useParams<{ machineId?: string }>();
  const currentMachineId = machineId || "local";

  return TAB_DEFINITIONS.map((tab) => ({
    ...tab,
    path: `/inspect/${currentMachineId}/${tab.id}`,
  }));
}

/**
 * Machine scope dropdown — visually distinct scope selector positioned inline
 * to the left of the Inspect tab navigation. Uses a badge/pill style to
 * differentiate it from the actual page tabs.
 *
 * Currently static with a single "local" option; will be populated from a
 * machines API endpoint in a future iteration. On change, navigates to the
 * same tab section on the selected machine.
 */
function MachineSelector({
  machineId,
  activeTab,
}: {
  machineId: string;
  activeTab: string;
}) {
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    navigate(`/inspect/${e.target.value}/${activeTab}`);
  };

  return (
    <div
      className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
        bg-slate-800/60 border border-slate-700/60
        text-slate-300 hover:text-slate-100 hover:border-slate-600
        transition-all duration-200 cursor-pointer"
    >
      <FaServer className="text-cyan-500/80 text-[11px]" />
      <select
        value={machineId}
        onChange={handleChange}
        className="appearance-none bg-transparent text-xs font-medium
          text-slate-300 group-hover:text-slate-100
          cursor-pointer outline-none pr-5
          focus:ring-0 focus:outline-none"
      >
        <option value="local" className="bg-slate-900 text-slate-200">
          local
        </option>
      </select>
      {/* Custom dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5
          text-slate-500 group-hover:text-slate-300 pointer-events-none
          transition-colors duration-200"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export default function InspectLayout() {
  const location = useLocation();
  const { machineId } = useParams<{ machineId?: string }>();
  const currentMachineId = machineId || "local";
  const tabs = useInspectTabs();

  // Determine active tab based on current path (machineId-agnostic)
  const getActiveTab = () => {
    const path = location.pathname;
    // Strip machineId prefix to check the actual tab section
    const suffix = path.replace(/^\/inspect\/[^/]+/, "");
    if (!suffix || suffix === "/overview") return "overview";
    if (suffix.startsWith("/files")) return "files";
    if (suffix.startsWith("/processes")) return "processes";
    if (suffix.startsWith("/terminal")) return "terminal";
    if (suffix.startsWith("/history")) return "history";
    if (suffix.startsWith("/events")) return "events";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation with inline Machine Selector */}
      <div className="flex-none border-b border-slate-800/50 px-6">
        <nav className="flex items-center gap-1" aria-label="Inspect navigation">
          {/* Machine Selector — inline before tabs */}
          <MachineSelector machineId={currentMachineId} activeTab={activeTab} />

          {/* Separator */}
          <div className="w-px h-5 bg-slate-700/50 mx-1" />

          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`
                  group relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                  transition-all duration-200 ease-in-out
                  ${
                    isActive
                      ? "text-cyan-400 border-b-2 border-cyan-400"
                      : "text-slate-400 hover:text-slate-200 border-b-2 border-transparent"
                  }
                `}
                aria-label={tab.description}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={isActive ? "text-cyan-400" : ""}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>

                {/* Tooltip - below */}
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-slate-900 border border-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {tab.description}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

import React from "react";
import { Link, useLocation } from "react-router";
import {
  FaCubes,
  FaChartLine,
  FaServer,
  FaNetworkWired,
  FaRobot,
  FaGlobe,
} from "react-icons/fa";

type NavGroup = "inspect" | "tools" | "manage";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  to: string;
  description: string;
  group: NavGroup;
  exact?: boolean; // For exact match (e.g., "/" should only match exactly "/")
}

const NAV_ITEMS: NavItem[] = [
  // Inspect Group (Cyan/Blue)
  {
    icon: <FaChartLine />,
    label: "Inspect",
    to: "/inspect",
    description: "Monitoring & Analytics",
    group: "inspect",
  },

  // Manage Group (Orange)
  {
    icon: <FaCubes />,
    label: "Apps",
    to: "/apps",
    description: "Applications",
    group: "manage",
  },
  {
    icon: <FaServer />,
    label: "Machines",
    to: "/machines",
    description: "Machines & Infrastructure",
    group: "manage",
  },
  {
    icon: <FaGlobe />,
    label: "Proxy",
    to: "/proxy",
    description: "Reverse Proxy",
    group: "manage",
  },
  {
    icon: <FaRobot />,
    label: "Automation",
    to: "/automation",
    description: "Cron & Automation",
    group: "manage",
  },
  {
    icon: <FaNetworkWired />,
    label: "Envs",
    to: "/envs",
    description: "Environments",
    group: "manage",
  },
];

const GROUP_CONFIG: Record<
  NavGroup,
  { label: string; colorClass: string; borderColor: string; bgClass: string }
> = {
  inspect: {
    label: "Inspect",
    colorClass: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    bgClass: "bg-cyan-500/5",
  },
  tools: {
    label: "Tools",
    colorClass: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgClass: "bg-emerald-500/5",
  },
  manage: {
    label: "Manage",
    colorClass: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgClass: "bg-amber-500/5",
  },
};

function isActiveRoute(currentPath: string, itemTo: string, exact?: boolean): boolean {
  if (exact) {
    return currentPath === itemTo;
  }
  // For /inspect, match both /inspect and /inspect/*
  if (itemTo === "/inspect") {
    return currentPath.startsWith("/inspect");
  }
  // For other routes, match if current path starts with the item's path
  return currentPath.startsWith(itemTo);
}

function getActiveGroup(currentPath: string): NavGroup | null {
  for (const item of NAV_ITEMS) {
    if (isActiveRoute(currentPath, item.to, item.exact)) {
      return item.group;
    }
  }
  return null;
}

export const NavigationBar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const activeGroup = getActiveGroup(currentPath);

  // Group items by their group
  const groupedItems = NAV_ITEMS.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<NavGroup, NavItem[]>
  );

  const renderNavItem = (item: NavItem) => {
    const isActive = isActiveRoute(currentPath, item.to, item.exact);
    const config = GROUP_CONFIG[item.group];

    return (
      <Link
        key={item.to + item.label}
        to={item.to}
        className={`
          group relative flex items-center gap-2 px-3 py-2 rounded-lg
          transition-all duration-200 ease-in-out
          ${isActive ? `${config.bgClass} ${config.colorClass} font-medium` : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}
        `}
        aria-label={item.description}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={`text-lg ${isActive ? config.colorClass : ""}`}>
          {item.icon}
        </span>
        <span className="text-sm hidden lg:inline">{item.label}</span>

        {/* Active indicator - bottom border */}
        {isActive && (
          <span
            className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r ${
              item.group === "inspect"
                ? "from-cyan-400 to-blue-500"
                : item.group === "tools"
                ? "from-emerald-400 to-green-500"
                : "from-amber-400 to-orange-500"
            }`}
          />
        )}

        {/* Tooltip - below */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-slate-900 border border-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          {item.description}
        </span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup, items: NavItem[]) => {
    const config = GROUP_CONFIG[group];
    const isGroupActive = activeGroup === group;

    return (
      <div
        key={group}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${config.borderColor} ${
          isGroupActive ? config.bgClass : ""
        }`}
      >
        {items.map(renderNavItem)}
      </div>
    );
  };

  return (
    <nav className="flex items-center gap-3" aria-label="Main navigation">
      {/* Inspect Group */}
      {groupedItems.inspect && renderGroup("inspect", groupedItems.inspect)}

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700/50" />

      {/* Tools Group */}
      {groupedItems.tools && renderGroup("tools", groupedItems.tools)}

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700/50" />

      {/* Manage Group */}
      {groupedItems.manage && renderGroup("manage", groupedItems.manage)}
    </nav>
  );
};

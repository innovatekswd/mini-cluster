import React, { useState, useEffect } from "react";
import {
  FaPlus,
  FaChevronRight,
  FaChevronDown,
  FaSearch,
  FaServer,
} from "react-icons/fa";
import type { Service } from "~/types/Service";
import { appsApiService } from "~/services/appsApiService";
import type { App } from "~/types/App";
import { ServiceListItem } from "./ServiceListItem";

interface SidePanelProps {
  apps: Service[];
  selectedAppId: string | null;
  onSelectApp: (id: string) => void;
  onSelectAppGroup?: (appId: string) => void;
  onAddApp: () => void;
  onEditApp: (id: string) => void;
  onDeleteApp: (id: string) => void;
  onSelectTab?: (tab: string) => void;
  loading?: boolean;
  error?: string | null;
  // App-scoped mode
  currentApp?: App | null;
  onNavigateBack?: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  apps,
  selectedAppId,
  onSelectApp,
  onSelectAppGroup,
  onAddApp,
  onEditApp,
  onDeleteApp,
  onSelectTab,
  loading,
  currentApp,
}) => {
  const isAppScoped = !!currentApp;
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [appsMap, setAppsMap] = useState<Map<string, App>>(new Map());

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const appsData = await appsApiService.getAll();
        setAppsMap(new Map(appsData.map(app => [app.id, app])));
      } catch (error) {
        console.error("Failed to fetch apps:", error);
      }
    };
    fetchApps();
  }, []);

  const filteredServices = apps.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedServices = filteredServices.reduce((acc, service) => {
    const appId = service.appId || "unassigned";
    if (!acc[appId]) acc[appId] = [];
    acc[appId].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <aside className="flex flex-col h-full w-64 bg-slate-900/95 border-r border-slate-800/50 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center px-3 py-2.5 border-b border-slate-800/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {isAppScoped ? "Services" : "All Services"}
        </span>
      </div>

      {/* Search — dashboard mode only */}
      {!isAppScoped && (
        <div className="px-3 pt-2.5 pb-1">
          <div className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
            />
          </div>
        </div>
      )}

      <div className="h-px bg-slate-800/60 mx-3 mt-1" />

      {/* Services List */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5" aria-label="Services navigation">
        {filteredServices.length === 0 ? (
          <div className="empty-state py-8">
            <FaServer className="empty-state-icon" />
            <p className="text-sm">No services found</p>
            {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
          </div>
        ) : isAppScoped ? (
          <div className="space-y-0.5" role="list">
            {filteredServices.map((service) => (
              <ServiceListItem
                key={service.id}
                service={service}
                onSelectApp={onSelectApp}
                onEditApp={onEditApp}
                onDeleteApp={onDeleteApp}
                onSelectTab={onSelectTab}
                selected={selectedAppId === service.id}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3" role="list">
            {Object.entries(groupedServices).map(([appId, services]) => {
              const app = appId !== "unassigned" ? appsMap.get(appId) : null;
              const isCollapsed = collapsedGroups.has(appId);
              const groupName = app ? `${app.icon} ${app.name}` : "📋 Unassigned";

              return (
                <div key={appId} className="space-y-0.5" role="listitem">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleGroup(appId)}
                      className="flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <FaChevronRight className="text-xs" /> : <FaChevronDown className="text-xs" />}
                    </button>
                    <button
                      onClick={() => {
                        if (appId !== "unassigned" && onSelectAppGroup) onSelectAppGroup(appId);
                      }}
                      className="flex-1 flex items-center justify-between px-1 py-1 rounded hover:bg-slate-800/50 transition-colors group min-w-0"
                    >
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 truncate">{groupName}</span>
                      <span className="text-xs text-slate-600 flex-shrink-0 ml-1">{services.length}</span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-0.5 ml-2" role="group">
                      {services.map((service) => (
                        <ServiceListItem
                          key={service.id}
                          service={service}
                          onSelectApp={onSelectApp}
                          onEditApp={onEditApp}
                          onDeleteApp={onDeleteApp}
                          onSelectTab={onSelectTab}
                          selected={selectedAppId === service.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Add Service — prominent at the bottom */}
      <div className="flex-none p-2 border-t border-slate-800/50">
        <button
          onClick={onAddApp}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white border border-dashed border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/60 transition-colors"
        >
          <FaPlus size={9} />
          Add Service
        </button>
      </div>
    </aside>
  );
};

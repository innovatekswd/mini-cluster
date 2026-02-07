import React, { useRef, useState, useEffect } from "react";
import {
  FaPlus,
  FaSync,
  FaEllipsisV,
  FaUpload,
  FaDownload,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaSearch,
  FaServer,
  FaThumbtack
} from "react-icons/fa";
import {
  useImportAppsMutation,
  useExportAppsMutation,
} from "~/hooks/useServiceQueries";
import type { Service } from "~/types/Service";
import { appsApiService } from "~/services/appsApiService";
import type { App } from "~/types/App";
import { ServiceListItem } from "./ServiceListItem";

interface SidePanelProps {
  apps: Service[];
  selectedAppId: string | null;
  onSelectApp: (id: string) => void;
  onAddApp: () => void;
  onEditApp: (id: string) => void;
  onDeleteApp: (id: string) => void;
  onSelectTab?: (tab: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
  isOpen?: boolean;  // For drawer mode
  onClose?: () => void;  // Close drawer
  isPinned?: boolean;  // Pin sidebar open
  onPinChange?: (pinned: boolean) => void;  // Toggle pin
}

export const SidePanel: React.FC<SidePanelProps> = ({
  apps,
  selectedAppId,
  onSelectApp,
  onAddApp,
  onEditApp,
  onDeleteApp,
  onSelectTab,
  onRefresh,
  loading,
  error = null,
  isOpen = true,
  onClose,
  isPinned = false,
  onPinChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importExportRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [appsMap, setAppsMap] = useState<Map<string, App>>(new Map());

  const importAppsMutation = useImportAppsMutation();
  const exportAppsMutation = useExportAppsMutation();

  // Fetch apps on mount
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const appsData = await appsApiService.getAll();
        const map = new Map(appsData.map(app => [app.id, app]));
        setAppsMap(map);
      } catch (error) {
        console.error("Failed to fetch apps:", error);
      }
    };
    fetchApps();
  }, []);

  // Filter services based on search query
  const filteredServices = apps.filter(service => 
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group services by app
  const groupedServices = filteredServices.reduce((acc, service) => {
    const appId = service.appId || 'unassigned';
    if (!acc[appId]) {
      acc[appId] = [];
    }
    acc[appId].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Count running services
  const runningServicesCount = apps.filter(service => service.id).length; // This would need actual status

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        importExportRef.current &&
        !importExportRef.current.contains(event.target as Node) &&
        showImportExport
      ) {
        setShowImportExport(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showImportExport]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || importing) return;
    try {
      setImporting(true);
      await importAppsMutation.mutateAsync(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error importing apps:", error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportApps = async () => {
    try {
      setShowImportExport(false);
      const exportData = await exportAppsMutation.mutateAsync();
      
      // Create blob from the new structured export format
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Use exportedAt from response or current date
      const exportDate = exportData.exportedAt 
        ? new Date(exportData.exportedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      link.download = `minicluster-config-${exportDate}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting apps:", error);
    }
  };

  // Close sidebar when selecting an app (only if not pinned)
  const handleSelectApp = (id: string) => {
    onSelectApp(id);
    if (onClose && !isPinned) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for drawer mode (only when not pinned) */}
      {isOpen && onClose && !isPinned && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        flex flex-col h-full
        ${collapsed ? "w-16" : "w-72"}
        bg-slate-900/95 border-r border-slate-800/50
        transition-all duration-300 ease-out
        
        ${isPinned 
          ? "relative z-auto" 
          : `fixed inset-y-0 left-0 z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"}`
        }
      `}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className={`
        flex items-center p-4 border-b border-slate-800/50
        ${collapsed ? "justify-center" : "justify-between"}
      `}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Services</h2>
            <span className="badge badge-info">{apps.length}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {/* Pin button */}
          {!collapsed && onPinChange && (
            <button
              onClick={() => onPinChange(!isPinned)}
              className={`icon-btn ${isPinned ? "text-cyan-400" : ""}`}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              <FaThumbtack className={`text-sm transition-transform ${isPinned ? "rotate-0" : "rotate-45"}`} />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="icon-btn"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-800/50">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <button onClick={onAddApp} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <FaPlus className="text-sm" />
                <span>Add Service</span>
              </button>
              
              <button
                onClick={onRefresh}
                className={`icon-btn ${loading ? "animate-spin" : ""}`}
                title="Refresh"
                disabled={loading}
              >
                <FaSync />
              </button>
              
              <div className="relative" ref={importExportRef}>
                <button
                  onClick={() => setShowImportExport(!showImportExport)}
                  className="icon-btn"
                  title="More options"
                >
                  <FaEllipsisV />
                </button>
                {showImportExport && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowImportExport(false); }}
                      className="dropdown-item w-full"
                    >
                      <FaUpload className="text-cyan-400" />
                      <span>Import Services</span>
                    </button>
                    <button onClick={handleExportApps} className="dropdown-item w-full">
                      <FaDownload className="text-emerald-400" />
                      <span>Export Services</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services List */}
          <nav className="flex-1 overflow-y-auto p-4" aria-label="Services navigation">
            {filteredServices.length === 0 ? (
              <div className="empty-state py-8">
                <FaServer className="empty-state-icon" />
                <p className="text-sm">No services found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try a different search term</p>
                )}
              </div>
            ) : (
              <div className="space-y-3" role="list">
                {Object.entries(groupedServices).map(([appId, services]) => {
                  const app = appId !== 'unassigned' ? appsMap.get(appId) : null;
                  const isCollapsed = collapsedGroups.has(appId);
                  const groupName = app ? `${app.icon} ${app.name}` : '📋 Unassigned';
                  
                  return (
                    <div key={appId} className="space-y-1" role="listitem">
                      {/* App Group Header */}
                      <button
                        onClick={() => toggleGroup(appId)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors group"
                        aria-expanded={!isCollapsed}
                        aria-controls={`service-group-${appId}`}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <FaChevronRight className="text-xs text-slate-500" />
                          ) : (
                            <FaChevronDown className="text-xs text-slate-500" />
                          )}
                          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300">
                            {groupName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600">{services.length}</span>
                      </button>
                      
                      {/* Services in this group */}
                      {!isCollapsed && (
                        <div id={`service-group-${appId}`} className="space-y-1 ml-2" role="group" aria-label={`${groupName} services`}>
                          {services.map((service) => (
                            <ServiceListItem
                              key={service.id}
                              service={service}
                              onSelectApp={handleSelectApp}
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
        </>
      )}
    </aside>
    </>
  );
};

<style>{`
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 4px;
  }
`}</style>;

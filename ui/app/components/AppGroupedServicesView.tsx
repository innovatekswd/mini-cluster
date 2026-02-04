import { useState, useMemo } from "react";
import { FaChevronDown, FaChevronRight, FaCubes } from "react-icons/fa";
import { ServiceCard } from "~/components/ServiceCard";
import type { AppWithStats } from "~/types/App";
import type { Service } from "~/types/Service";

interface AppGroupedServicesViewProps {
  apps: AppWithStats[];
  services: Service[];
  onEdit: (service: Service) => void;
}

interface AppGroup {
  app: AppWithStats | null;
  services: Service[];
}

export function AppGroupedServicesView({ apps, services, onEdit }: AppGroupedServicesViewProps) {
  const [expandedApps, setExpandedApps] = useState<Set<string>>(
    new Set(apps.map(a => a.id).concat(['unassigned']))
  );

  // Group services by app
  const groupedServices = useMemo(() => {
    const groups: AppGroup[] = [];
    
    // Group services by app
    const appMap = new Map<string, Service[]>();
    const unassigned: Service[] = [];

    for (const service of services) {
      if (service.appId) {
        const existing = appMap.get(service.appId) || [];
        existing.push(service);
        appMap.set(service.appId, existing);
      } else {
        unassigned.push(service);
      }
    }

    // Create groups for each app
    for (const app of apps) {
      const appServices = appMap.get(app.id) || [];
      if (appServices.length > 0) {
        groups.push({ app, services: appServices });
      }
    }

    // Add unassigned services group
    if (unassigned.length > 0) {
      groups.push({ app: null, services: unassigned });
    }

    return groups;
  }, [apps, services]);

  const toggleApp = (appId: string) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const getRunningCount = (services: Service[]) => {
    return services.filter(s => s.status?.toLowerCase() === 'running').length;
  };

  if (groupedServices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FaCubes className="w-16 h-16 text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No services found</h2>
        <p className="text-gray-400">
          Services will appear here once they are created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedServices.map((group) => {
        const groupId = group.app?.id || 'unassigned';
        const isExpanded = expandedApps.has(groupId);
        const runningCount = getRunningCount(group.services);

        return (
          <div
            key={groupId}
            className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden"
          >
            {/* App Header */}
            <button
              onClick={() => toggleApp(groupId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
            >
              {/* Expand/Collapse Icon */}
              <div className="text-slate-400">
                {isExpanded ? (
                  <FaChevronDown className="w-3 h-3" />
                ) : (
                  <FaChevronRight className="w-3 h-3" />
                )}
              </div>

              {/* App Icon */}
              {group.app ? (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: `${group.app.color || '#3b82f6'}20` }}
                >
                  {group.app.icon || '📦'}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-700/50 flex-shrink-0">
                  <FaCubes className="w-5 h-5 text-slate-400" />
                </div>
              )}

              {/* App Name & Stats */}
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">
                  {group.app?.name || 'Unassigned Services'}
                </div>
                <div className="text-xs text-slate-500">
                  {group.services.length} {group.services.length === 1 ? 'service' : 'services'}
                  {runningCount > 0 && (
                    <span className="ml-2 text-emerald-400">
                      • {runningCount} running
                    </span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {runningCount === group.services.length && group.services.length > 0 ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                    All Running
                  </span>
                ) : runningCount > 0 ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">
                    Partial
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-600/50 text-slate-400">
                    Stopped
                  </span>
                )}
              </div>
            </button>

            {/* Services Grid */}
            {isExpanded && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.services.map((service) => (
                    <ServiceCard 
                      key={service.id} 
                      service={service} 
                      app={group.app ? { id: group.app.id, name: group.app.name, icon: group.app.icon } : null}
                      onEdit={onEdit} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

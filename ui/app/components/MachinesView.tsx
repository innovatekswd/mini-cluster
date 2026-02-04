import React, { useState, useEffect, memo, useCallback } from "react";
import { 
  FaServer, FaPlus, FaSync, FaDesktop, FaCloud, FaNetworkWired,
  FaPlay, FaStop, FaCog, FaTrash, FaChevronDown, FaChevronRight,
  FaDocker, FaTerminal, FaCircle, FaExclamationTriangle
} from "react-icons/fa";
import { useMachinesWithServicesQuery, useTestConnectionMutation } from "~/hooks/useMachinesQueries";
import { useAppControlMutation } from "~/hooks/useServiceQueries";
import type { Machine } from "~/types/Phase5Types";
import type { Service } from "~/types/Service";

interface MachinesViewProps {
  onSelectService?: (service: Service) => void;
  selectedServiceId?: string;
}

export function MachinesView({ onSelectService, selectedServiceId }: MachinesViewProps) {
  const { machines, services, isLoading, refetch } = useMachinesWithServicesQuery();
  const testConnectionMutation = useTestConnectionMutation();
  const serviceControlMutation = useAppControlMutation();
  
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [showAddMachine, setShowAddMachine] = useState(false);

  // Auto-expand local machine on initial load
  useEffect(() => {
    if (machines.length > 0) {
      const localMachine = machines.find(m => m.isLocal);
      if (localMachine && expandedMachines.size === 0) {
        setExpandedMachines(new Set([localMachine.id]));
      }
    }
  }, [machines]);

  const toggleMachine = useCallback((machineId: string) => {
    setExpandedMachines(prev => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  }, []);

  const handleTestConnection = useCallback((machine: Machine) => {
    testConnectionMutation.mutate({ id: machine.id, name: machine.name });
  }, [testConnectionMutation]);

  const handleServiceAction = useCallback((service: Service, action: "start" | "stop" | "restart") => {
    serviceControlMutation.mutate(
      { appId: service.id, appName: service.name, action },
      { onSuccess: () => refetch() }
    );
  }, [serviceControlMutation, refetch]);

  const getMachineIcon = (machine: Machine) => {
    if (machine.isLocal) return FaDesktop;
    if (machine.connectionType === "ssh") return FaTerminal;
    if (machine.connectionType === "agent") return FaCloud;
    return FaServer;
  };

  const getServiceIcon = (service: Service) => {
    if (service.type === "container") return FaDocker;
    if (service.type === "pod") return FaNetworkWired;
    return FaTerminal;
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "online":
        return "text-emerald-400";
      case "stopped":
      case "offline":
        return "text-slate-500";
      case "starting":
      case "stopping":
        return "text-amber-400 animate-pulse";
      case "failed":
      case "error":
        return "text-rose-400";
      default:
        return "text-slate-600";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 
            flex items-center justify-center shadow-lg shadow-violet-500/20">
            <FaServer className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Machines</h2>
            <p className="text-sm text-slate-500">
              {machines.length} machine{machines.length !== 1 ? "s" : ""} • 
              {Object.values(services).flat().length} service{Object.values(services).flat().length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn-secondary p-2"
            title="Refresh"
          >
            <FaSync className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddMachine(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FaPlus className="w-3 h-3" />
            <span>Add Machine</span>
          </button>
        </div>
      </div>

      {/* Machine List */}
      <div className="flex-1 overflow-auto space-y-3">
        {machines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <FaServer className="w-12 h-12 mb-4 opacity-30" />
            <p>No machines configured</p>
            <button
              onClick={() => setShowAddMachine(true)}
              className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm"
            >
              Add your first machine
            </button>
          </div>
        ) : (
          machines.map((machine) => {
            const MachineIcon = getMachineIcon(machine);
            const isExpanded = expandedMachines.has(machine.id);
            const machineServices = services[machine.id] || [];
            const runningCount = machineServices.filter(s => s.status === "running").length;

            return (
              <div 
                key={machine.id}
                className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-800/30"
              >
                {/* Machine Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => toggleMachine(machine.id)}
                >
                  <button className="text-slate-400">
                    {isExpanded ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
                  </button>
                  
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                    ${machine.isLocal 
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
                      : "bg-slate-700"
                    }`}
                  >
                    <MachineIcon className="w-4 h-4 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 truncate">{machine.name}</span>
                      {machine.isLocal && (
                        <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded">
                          Local
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{machine.host || "localhost"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <FaCircle className={`w-2 h-2 ${getStatusColor(machine.status)}`} />
                        {machine.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="text-slate-300">{machineServices.length} services</div>
                      <div className="text-slate-500 text-xs">{runningCount} running</div>
                    </div>
                    
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleTestConnection(machine)}
                        disabled={testConnectionMutation.isPending && testConnectionMutation.variables?.id === machine.id}
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                        title="Test Connection"
                      >
                        {testConnectionMutation.isPending && testConnectionMutation.variables?.id === machine.id ? (
                          <FaSync className="w-4 h-4 animate-spin" />
                        ) : (
                          <FaNetworkWired className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                        title="Settings"
                      >
                        <FaCog className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Services List */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 bg-slate-900/30">
                    {machineServices.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        No services on this machine
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/30">
                        {machineServices.map((service) => {
                          const ServiceIcon = getServiceIcon(service);
                          const isSelected = service.id === selectedServiceId;

                          return (
                            <div
                              key={service.id}
                              className={`
                                flex items-center gap-3 px-4 py-3 pl-12 cursor-pointer transition-colors
                                ${isSelected 
                                  ? "bg-cyan-500/10 border-l-2 border-cyan-500" 
                                  : "hover:bg-slate-700/20 border-l-2 border-transparent"
                                }
                              `}
                              onClick={() => onSelectService?.(service)}
                            >
                              <div className={`w-6 h-6 rounded flex items-center justify-center
                                ${service.type === "container" ? "bg-blue-500/20 text-blue-400" :
                                  service.type === "pod" ? "bg-violet-500/20 text-violet-400" :
                                  "bg-slate-700 text-slate-400"
                                }`}
                              >
                                <ServiceIcon className="w-3 h-3" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-300 truncate">{service.name}</span>
                                  <span className="text-xs text-slate-500">({service.type})</span>
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {service.type === "container" ? service.image : service.executablePath}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <FaCircle className={`w-2 h-2 ${getStatusColor(service.status)}`} />
                                <span className={`text-xs ${getStatusColor(service.status)}`}>
                                  {service.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {service.status === "running" ? (
                                  <button
                                    onClick={() => handleServiceAction(service, "stop")}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                    title="Stop"
                                  >
                                    <FaStop className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleServiceAction(service, "start")}
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                    title="Start"
                                  >
                                    <FaPlay className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleServiceAction(service, "restart")}
                                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                  title="Restart"
                                >
                                  <FaSync className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Machine Modal - Placeholder */}
      {showAddMachine && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddMachine(false)}
        >
          <div 
            className="card-elevated max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Add Machine</h3>
            <p className="text-slate-400 mb-6">
              Machine configuration form will be implemented here.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddMachine(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => setShowAddMachine(false)} className="btn-primary">
                Add Machine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

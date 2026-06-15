import { useState } from "react";
import { TaskManager } from "~/components/TaskManager";

type ResourceTab = "processes" | "performance" | "disks" | "network" | "history";
const VALID_TABS: ResourceTab[] = ["processes", "performance", "disks", "network", "history"];

export default function ObserveResourcesPage() {
  const [activeTab, setActiveTab] = useState<ResourceTab>("processes");

  const handleSelectService = (_serviceId: string) => {
    // Navigate to service details if needed
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-slate-800/50">
        <h1 className="text-xl font-bold text-slate-100">System Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Detailed view of system resources, processes, and performance metrics
        </p>
      </div>

      {/* Task Manager Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TaskManager
          onSelectService={handleSelectService}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ResourceTab)}
        />
      </div>
    </div>
  );
}

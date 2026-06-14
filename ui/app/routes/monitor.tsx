import { useNavigate, useParams } from "react-router";
import { TaskManager } from "../components/TaskManager";

type MonitorTab = "processes" | "performance" | "disks" | "network" | "history";
const VALID_TABS: MonitorTab[] = ["processes", "performance", "disks", "network", "history"];

export default function MonitorPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: MonitorTab = VALID_TABS.includes(tab as MonitorTab) ? (tab as MonitorTab) : "processes";

  const handleSelectApp = (appId: string) => {
    navigate(`/?app=${appId}`);
  };

  const handleTabChange = (newTab: MonitorTab) => {
    navigate(`/monitor/${newTab}`, { replace: true });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-slate-100">System Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time system and application performance monitoring
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskManager onSelectService={handleSelectApp} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
}

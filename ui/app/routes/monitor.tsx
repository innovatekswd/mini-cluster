import { useNavigate } from "react-router";
import { TaskManager } from "../components/TaskManager";
import { Layout } from "../components/Layout";

export default function MonitorPage() {
  const navigate = useNavigate();

  const handleSelectApp = (appId: string) => {
    // Navigate to dashboard with the app selected via query param
    navigate(`/?app=${appId}`);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <h1 className="text-2xl font-bold text-slate-100">System Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time system and application performance monitoring
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <TaskManager onSelectService={handleSelectApp} />
        </div>
      </div>
    </Layout>
  );
}

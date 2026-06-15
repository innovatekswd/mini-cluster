import { HistoryTab } from "~/components/HistoryTab";

export default function ObserveHistoryPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-6 py-4 border-b border-slate-800/50">
        <h1 className="text-xl font-bold text-slate-100">Historical Metrics</h1>
        <p className="text-sm text-slate-400 mt-1">
          Explore historical performance data with flexible time ranges and comparison modes
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <HistoryTab />
      </div>
    </div>
  );
}

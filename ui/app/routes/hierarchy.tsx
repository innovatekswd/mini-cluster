import { useNavigate } from "react-router";
import { Layout } from "~/components/Layout";
import { AppTreeView } from "~/components/AppTreeView";
import {
  useAppSnapshotsQuery,
  useCreateSnapshotMutation,
} from "~/hooks/useVersioningQueries";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";
import { useState } from "react";
import { FaCamera, FaPlus, FaSync } from "react-icons/fa";
import { Modal } from "~/components/Modal";
import type { CreateAppSnapshotDto } from "~/types/PostMvpTypes";

function SnapshotPanel() {
  const { data: apps = [] } = useAppsWithStatsQuery();
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const { data: snapshots = [], isLoading } = useAppSnapshotsQuery(selectedAppId);
  const createMut = useCreateSnapshotMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateAppSnapshotDto>({ version: "", label: "" });

  const handleCreate = () => {
    if (!selectedAppId) return;
    createMut.mutate(
      { appId: selectedAppId, data: form },
      { onSuccess: () => { setShowCreate(false); setForm({ version: "", label: "" }); } }
    );
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <FaCamera className="text-slate-500" />
        App Snapshots
      </h3>
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input-dark text-sm"
          title="Select app"
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
        >
          <option value="">Select an app...</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {selectedAppId && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1 transition-colors"
          >
            <FaPlus size={10} /> Snapshot
          </button>
        )}
      </div>

      {selectedAppId && (
        isLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/60" />)}
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-slate-500">No snapshots for this app.</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div key={snap.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 text-sm font-mono">{snap.version}</span>
                    {snap.label && <span className="text-slate-400 text-xs ml-2">({snap.label})</span>}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(snap.createdAt).toLocaleString()}</span>
                </div>
                {snap.entries?.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    {snap.entries.map((e) => (
                      <div key={e.serviceId}>
                        {e.serviceName}: <span className="font-mono text-slate-400">{e.serviceVersion}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Snapshot" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Version</label>
            <input className="input-dark w-full" value={form.version ?? ""} onChange={(e) => setForm(p => ({ ...p, version: e.target.value }))} placeholder="Auto-generated" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Label</label>
            <input className="input-dark w-full" value={form.label ?? ""} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. pre-release" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={createMut.isPending} className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
              {createMut.isPending ? <FaSync className="animate-spin" size={10} /> : <FaCamera size={10} />} Create
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function HierarchyPage() {
  const navigate = useNavigate();

  return (
      <div className="h-full overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">App Hierarchy</h1>
          <p className="text-slate-400 text-sm">
            View and manage your application tree structure, move apps, and control entire branches
          </p>
        </div>

        <AppTreeView onNavigate={(slug) => navigate(`/apps/${encodeURIComponent(slug)}`)} />

        <SnapshotPanel />
      </div>
  );
}

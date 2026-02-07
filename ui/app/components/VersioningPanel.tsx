import React, { useState } from "react";
import {
  FaCodeBranch, FaPlus, FaRocket, FaUndoAlt, FaCog,
  FaSave, FaTimes, FaSync, FaCheck, FaChevronDown, FaChevronRight,
  FaCamera, FaHistory,
} from "react-icons/fa";
import { Modal } from "~/components/Modal";
import {
  useServiceVersionsQuery,
  useCreateVersionMutation,
  useDeployVersionMutation,
  useRollbackMutation,
  useDeploymentConfigQuery,
  useUpdateDeploymentConfigMutation,
} from "~/hooks/useVersioningQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import type { CreateVersionDto, UpdateDeploymentConfigDto } from "~/types/PostMvpTypes";
import { DeploymentStatus, VersionSource, DeploymentStrategy } from "~/types/PostMvpTypes";

// ── Helpers ─────────────────────────────────────────────────

const statusBadge = (s: DeploymentStatus) => {
  const map: Record<number, { bg: string; text: string; label: string }> = {
    [DeploymentStatus.Pending]:    { bg: "bg-slate-500/10", text: "text-slate-400",   label: "Pending" },
    [DeploymentStatus.Deploying]:  { bg: "bg-blue-500/10",  text: "text-blue-400",    label: "Deploying" },
    [DeploymentStatus.Active]:     { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Active" },
    [DeploymentStatus.RolledBack]: { bg: "bg-amber-500/10", text: "text-amber-400",   label: "Rolled Back" },
    [DeploymentStatus.Failed]:     { bg: "bg-rose-500/10",  text: "text-rose-400",    label: "Failed" },
    [DeploymentStatus.Superseded]: { bg: "bg-violet-500/10", text: "text-violet-400",  label: "Superseded" },
  };
  const c = map[s] ?? { bg: "bg-slate-500/10", text: "text-slate-400", label: "Unknown" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
};

const sourceLabel = (s: VersionSource) =>
  ["Manual", "Auto-Save", "Git", "Deploy"][s] ?? "Unknown";

const strategyLabel = (s: DeploymentStrategy | number) =>
  ["In-Place", "Blue-Green", "Rolling"][s] ?? "Unknown";

interface Props {
  serviceId: string;
}

// ── Version Create Form ─────────────────────────────────────

function CreateVersionForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (d: CreateVersionDto) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateVersionDto>({
    version: "",
    label: "",
    source: VersionSource.Manual,
    notes: "",
  });
  const set = <K extends keyof CreateVersionDto>(k: K, v: CreateVersionDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Version</label>
          <input className="input-dark w-full" value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="Auto-generated if empty" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Label</label>
          <input className="input-dark w-full" value={form.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="e.g. stable" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
        <textarea className="input-dark w-full h-20 resize-none" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Deployment notes..." />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/50">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {isPending ? <FaSync className="animate-spin" /> : <FaCheck />} Create Version
        </button>
      </div>
    </form>
  );
}

// ── Deployment Config Editor ────────────────────────────────

function DeploymentConfigEditor({ serviceId }: { serviceId: string }) {
  const { data: config, isLoading } = useDeploymentConfigQuery(serviceId);
  const updateMut = useUpdateDeploymentConfigMutation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateDeploymentConfigDto>({});

  React.useEffect(() => {
    if (config) {
      setForm({
        strategy: config.strategy,
        autoRollbackOnFailure: config.autoRollbackOnFailure,
        rollbackTimeoutSeconds: config.rollbackTimeoutSeconds,
        waitForHealthy: config.waitForHealthy,
        healthCheckTimeoutSeconds: config.healthCheckTimeoutSeconds,
        maxVersionsToKeep: config.maxVersionsToKeep,
        autoVersionOnSave: config.autoVersionOnSave,
      });
    }
  }, [config]);

  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-slate-800/60" />;
  if (!config) return null;

  const set = <K extends keyof UpdateDeploymentConfigDto>(k: K, v: UpdateDeploymentConfigDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    updateMut.mutate({ serviceId, data: form }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <FaCog className="text-slate-500" size={11} /> Deployment Config
        </h4>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs text-cyan-400 hover:text-cyan-300">Edit</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={updateMut.isPending} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              {updateMut.isPending ? <FaSync className="animate-spin" size={10} /> : <FaSave size={10} />} Save
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-slate-300">Cancel</button>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
        {editing ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Strategy</label>
                <select className="input-dark w-full text-sm" value={form.strategy ?? 0} onChange={(e) => set("strategy", Number(e.target.value))}>
                  <option value={DeploymentStrategy.InPlace}>In-Place</option>
                  <option value={DeploymentStrategy.BlueGreen}>Blue-Green</option>
                  <option value={DeploymentStrategy.Rolling}>Rolling</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Versions to Keep</label>
                <input type="number" className="input-dark w-full text-sm" value={form.maxVersionsToKeep ?? 10} onChange={(e) => set("maxVersionsToKeep", Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Health Check Timeout (s)</label>
                <input type="number" className="input-dark w-full text-sm" value={form.healthCheckTimeoutSeconds ?? 30} onChange={(e) => set("healthCheckTimeoutSeconds", Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rollback Timeout (s)</label>
                <input type="number" className="input-dark w-full text-sm" value={form.rollbackTimeoutSeconds ?? 60} onChange={(e) => set("rollbackTimeoutSeconds", Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.autoRollbackOnFailure ?? true} onChange={(e) => set("autoRollbackOnFailure", e.target.checked)} className="accent-cyan-500" />
                Auto-rollback on failure
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.waitForHealthy ?? true} onChange={(e) => set("waitForHealthy", e.target.checked)} className="accent-cyan-500" />
                Wait for healthy
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.autoVersionOnSave ?? false} onChange={(e) => set("autoVersionOnSave", e.target.checked)} className="accent-cyan-500" />
                Auto-version on save
              </label>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-400 text-sm">Strategy</span>
              <span className="text-slate-200 text-sm">{strategyLabel(config.strategy)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-400 text-sm">Max Versions</span>
              <span className="text-slate-200 text-sm">{config.maxVersionsToKeep}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-400 text-sm">Auto-rollback</span>
              <span className={`text-sm ${config.autoRollbackOnFailure ? "text-emerald-400" : "text-slate-500"}`}>
                {config.autoRollbackOnFailure ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-400 text-sm">Auto-version on save</span>
              <span className={`text-sm ${config.autoVersionOnSave ? "text-emerald-400" : "text-slate-500"}`}>
                {config.autoVersionOnSave ? "Yes" : "No"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Version Panel ──────────────────────────────────────

export function VersioningPanel({ serviceId }: Props) {
  const { data: versions = [], isLoading } = useServiceVersionsQuery(serviceId);
  const createMut = useCreateVersionMutation();
  const deployMut = useDeployVersionMutation();
  const rollbackMut = useRollbackMutation();
  const { confirm } = useConfirm();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const activeVersion = versions.find(v => v.deploymentStatus === DeploymentStatus.Active);

  const handleCreateVersion = (data: CreateVersionDto) => {
    createMut.mutate({ serviceId, data }, { onSuccess: () => setShowCreateModal(false) });
  };

  const handleDeploy = async (versionId: number, versionLabel: string) => {
    const ok = await confirm({
      title: "Deploy Version",
      message: `Deploy version "${versionLabel}" to this service?`,
      confirmLabel: "Deploy",
      variant: "warning",
    });
    if (ok) deployMut.mutate({ serviceId, versionId });
  };

  const handleRollback = async () => {
    const ok = await confirm({
      title: "Rollback",
      message: "Rollback to the previous version?",
      confirmLabel: "Rollback",
      variant: "danger",
    });
    if (ok) rollbackMut.mutate(serviceId);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-6 w-40 rounded bg-slate-800/60" />
        <div className="h-32 rounded-lg bg-slate-800/60" />
      </div>
    );
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <FaCodeBranch className="text-slate-500" />
          Versions
          {versions.length > 0 && (
            <span className="text-xs font-normal text-slate-500">({versions.length})</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 rounded-lg transition-colors ${showConfig ? "text-cyan-400 bg-cyan-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}`}
            title="Deployment config"
          >
            <FaCog size={12} />
          </button>
          {activeVersion && (
            <button
              onClick={handleRollback}
              disabled={rollbackMut.isPending}
              className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors"
              title="Rollback"
            >
              {rollbackMut.isPending ? <FaSync className="animate-spin" size={12} /> : <FaUndoAlt size={12} />}
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1 transition-colors"
          >
            <FaPlus size={10} /> New Version
          </button>
        </div>
      </div>

      {/* Active version badge */}
      {activeVersion && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <FaRocket className="text-emerald-400" size={12} />
          <span className="text-emerald-400 font-medium">Active:</span>
          <span className="text-slate-200 font-mono">{activeVersion.version}</span>
          {activeVersion.label && (
            <span className="text-slate-400">({activeVersion.label})</span>
          )}
        </div>
      )}

      {/* Version list */}
      {versions.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
          <FaCodeBranch className="mx-auto text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 mb-3">No versions created yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 mx-auto text-sm"
          >
            <FaPlus size={10} /> Create First Version
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50 max-h-64 overflow-auto">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200 text-sm font-mono">{v.version}</span>
                  {statusBadge(v.deploymentStatus)}
                  {v.label && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400">
                      {v.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  <span>{sourceLabel(v.source)}</span>
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                  {v.gitCommit && <span className="font-mono">{v.gitCommit.substring(0, 7)}</span>}
                </div>
              </div>
              {v.deploymentStatus !== DeploymentStatus.Active && (
                <button
                  onClick={() => handleDeploy(v.id, v.version)}
                  disabled={deployMut.isPending}
                  className="px-2.5 py-1 text-xs rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors flex items-center gap-1"
                  title="Deploy this version"
                >
                  <FaRocket size={10} /> Deploy
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deployment config (collapsible) */}
      {showConfig && <DeploymentConfigEditor serviceId={serviceId} />}

      {/* Create version modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Version"
        size="md"
      >
        <CreateVersionForm
          onSubmit={handleCreateVersion}
          onCancel={() => setShowCreateModal(false)}
          isPending={createMut.isPending}
        />
      </Modal>
    </section>
  );
}

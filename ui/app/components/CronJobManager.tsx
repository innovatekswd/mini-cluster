import React, { useState } from "react";
import {
  FaClock, FaPlus, FaPlay, FaPause, FaBolt, FaTrash, FaEdit,
  FaCheck, FaTimes, FaExclamationTriangle, FaHistory, FaSync,
  FaChevronDown, FaChevronRight
} from "react-icons/fa";
import { Modal } from "~/components/Modal";
import {
  useCronJobsQuery,
  useCronJobRunsQuery,
  useCreateCronJobMutation,
  useUpdateCronJobMutation,
  useDeleteCronJobMutation,
  useToggleCronJobMutation,
  useTriggerCronJobMutation,
} from "~/hooks/useCronQueries";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import type { CronJob, CreateCronJobDto, UpdateCronJobDto } from "~/types/PostMvpTypes";
import { CronTarget, CronAction, CronMissedPolicy, CronRunStatus } from "~/types/PostMvpTypes";

// ── Helpers ─────────────────────────────────────────────────

const targetLabel = (t: CronTarget) =>
  ["App", "Service", "Group", "Script"][t] ?? "Unknown";
const actionLabel = (a: CronAction) =>
  ["Start", "Stop", "Restart", "Execute"][a] ?? "Unknown";
const missedLabel = (m: CronMissedPolicy) =>
  ["Run Once", "Run All", "Skip"][m] ?? "Unknown";

function runStatusBadge(s: CronRunStatus) {
  const map: Record<number, { bg: string; text: string; label: string }> = {
    [CronRunStatus.Pending]:  { bg: "bg-slate-500/10", text: "text-slate-400",   label: "Pending" },
    [CronRunStatus.Running]:  { bg: "bg-blue-500/10",  text: "text-blue-400",    label: "Running" },
    [CronRunStatus.Success]:  { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Success" },
    [CronRunStatus.Failed]:   { bg: "bg-rose-500/10",  text: "text-rose-400",    label: "Failed" },
    [CronRunStatus.Skipped]:  { bg: "bg-amber-500/10", text: "text-amber-400",   label: "Skipped" },
    [CronRunStatus.TimedOut]: { bg: "bg-orange-500/10", text: "text-orange-400",  label: "Timed Out" },
  };
  const c = map[s] ?? { bg: "bg-slate-500/10", text: "text-slate-400", label: "Unknown" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function relativeTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 0) {
    const secs = Math.round(-diff / 1000);
    if (secs < 60) return `in ${secs}s`;
    if (secs < 3600) return `in ${Math.round(secs / 60)}m`;
    if (secs < 86400) return `in ${Math.round(secs / 3600)}h`;
    return `in ${Math.round(secs / 86400)}d`;
  }
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

// ── CreateCronJobForm ──────────────────────────────────────

interface FormProps {
  initial?: CronJob | null;
  onSubmit: (data: CreateCronJobDto | UpdateCronJobDto) => void;
  onCancel: () => void;
  isPending: boolean;
}

function CronJobForm({ initial, onSubmit, onCancel, isPending }: FormProps) {
  const { data: apps = [] } = useAppsWithStatsQuery();
  const [form, setForm] = useState<CreateCronJobDto>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    targetType: initial?.targetType ?? CronTarget.App,
    appId: initial?.appId ?? "",
    serviceId: initial?.serviceId ?? "",
    scriptPath: initial?.scriptPath ?? "",
    cronExpression: initial?.cronExpression ?? "0 */5 * * * *",
    timezone: initial?.timezone ?? "",
    action: initial?.action ?? CronAction.Restart,
    waitForCompletion: initial?.waitForCompletion ?? true,
    timeoutSeconds: initial?.timeoutSeconds ?? 300,
    missedPolicy: initial?.missedPolicy ?? CronMissedPolicy.RunOnce,
  });

  const set = <K extends keyof CreateCronJobDto>(k: K, v: CreateCronJobDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
        <input
          className="input-dark w-full"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          placeholder="e.g. nightly-restart"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
        <input
          className="input-dark w-full"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional description"
        />
      </div>

      {/* Target Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Target Type</label>
          <select
            className="input-dark w-full"
            title="Target Type"
            value={form.targetType}
            onChange={(e) => set("targetType", Number(e.target.value) as CronTarget)}
          >
            <option value={CronTarget.App}>App</option>
            <option value={CronTarget.Service}>Service</option>
            <option value={CronTarget.Script}>Script</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Action</label>
          <select
            className="input-dark w-full"
            title="Action"
            value={form.action}
            onChange={(e) => set("action", Number(e.target.value) as CronAction)}
          >
            <option value={CronAction.Start}>Start</option>
            <option value={CronAction.Stop}>Stop</option>
            <option value={CronAction.Restart}>Restart</option>
            <option value={CronAction.Execute}>Execute</option>
          </select>
        </div>
      </div>

      {/* Target selector */}
      {form.targetType === CronTarget.App && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">App</label>
          <select
            className="input-dark w-full"
            title="App"
            value={form.appId ?? ""}
            onChange={(e) => set("appId", e.target.value)}
          >
            <option value="">— Select App —</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}
      {form.targetType === CronTarget.Service && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Service ID</label>
          <input
            className="input-dark w-full"
            value={form.serviceId ?? ""}
            onChange={(e) => set("serviceId", e.target.value)}
            placeholder="Service GUID"
          />
        </div>
      )}
      {form.targetType === CronTarget.Script && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Script Path</label>
          <input
            className="input-dark w-full"
            value={form.scriptPath ?? ""}
            onChange={(e) => set("scriptPath", e.target.value)}
            placeholder="/path/to/script.sh"
          />
        </div>
      )}

      {/* Cron Expression */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Cron Expression <span className="text-slate-500">(6-field with seconds)</span>
        </label>
        <input
          className="input-dark w-full font-mono"
          value={form.cronExpression}
          onChange={(e) => set("cronExpression", e.target.value)}
          required
          placeholder="0 */5 * * * *"
        />
        <p className="text-xs text-slate-500 mt-1">
          Format: second minute hour day month weekday &mdash; e.g. &quot;0 0 3 * * *&quot; = daily 3 AM
        </p>
      </div>

      {/* Advanced row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Timeout (s)</label>
          <input
            type="number"
            className="input-dark w-full"
            placeholder="300"
            value={form.timeoutSeconds ?? 300}
            onChange={(e) => set("timeoutSeconds", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Missed Policy</label>
          <select
            className="input-dark w-full"
            title="Missed Policy"
            value={form.missedPolicy}
            onChange={(e) => set("missedPolicy", Number(e.target.value) as CronMissedPolicy)}
          >
            <option value={CronMissedPolicy.RunOnce}>Run Once</option>
            <option value={CronMissedPolicy.RunAll}>Run All</option>
            <option value={CronMissedPolicy.Skip}>Skip</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.waitForCompletion ?? true}
              onChange={(e) => set("waitForCompletion", e.target.checked)}
              className="accent-cyan-500"
              title="Wait for completion"
            />
            Wait for Completion
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !form.name || !form.cronExpression}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isPending ? <FaSync className="animate-spin" /> : <FaCheck />}
          {initial ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// ── RunHistory drawer ───────────────────────────────────────

function RunHistoryPanel({ jobId, jobName }: { jobId: string; jobName: string }) {
  const { data: runs = [], isLoading } = useCronJobRunsQuery(jobId);

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <FaHistory className="text-slate-500" />
        Run History — {jobName}
      </h4>
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-800/60" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-slate-500">No runs yet.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto">
          {runs.map((r) => (
            <div
              key={r.id}
              className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm"
            >
              <div className="flex items-center justify-between">
                {runStatusBadge(r.status)}
                <span className="text-slate-500 text-xs">
                  {new Date(r.startedAt).toLocaleString()}
                </span>
              </div>
              {r.durationSeconds != null && (
                <span className="text-xs text-slate-500">Duration: {r.durationSeconds}s</span>
              )}
              {r.error && (
                <p className="text-xs text-rose-400 mt-1 truncate">{r.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export function CronJobManager() {
  const { data: jobs = [], isLoading } = useCronJobsQuery();
  const createMut = useCreateCronJobMutation();
  const updateMut = useUpdateCronJobMutation();
  const deleteMut = useDeleteCronJobMutation();
  const toggleMut = useToggleCronJobMutation();
  const triggerMut = useTriggerCronJobMutation();
  const { confirm } = useConfirm();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingJob(null);
    setShowFormModal(true);
  };
  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    setShowFormModal(true);
  };
  const handleDelete = async (job: CronJob) => {
    const ok = await confirm({
      title: "Delete Cron Job",
      message: `Delete "${job.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) deleteMut.mutate(job.id);
  };

  const handleFormSubmit = (data: CreateCronJobDto | UpdateCronJobDto) => {
    if (editingJob) {
      updateMut.mutate(
        { id: editingJob.id, data: data as UpdateCronJobDto },
        { onSuccess: () => setShowFormModal(false) }
      );
    } else {
      createMut.mutate(data as CreateCronJobDto, {
        onSuccess: () => setShowFormModal(false),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaClock className="text-cyan-400" />
            Scheduled Jobs
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage cron-based scheduling for apps, services, and scripts
          </p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
          <FaPlus size={12} /> New Job
        </button>
      </div>

      {/* Job List */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/60" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FaClock className="text-5xl text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Scheduled Jobs</h3>
          <p className="text-slate-500 mb-6 max-w-sm">
            Create a cron job to automatically start, stop, or restart your services on a schedule.
          </p>
          <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
            <FaPlus size={12} /> Create First Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isExpanded = expandedJob === job.id;
            return (
              <div
                key={job.id}
                className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
              >
                {/* Job row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                  </button>

                  {/* Enable toggle */}
                  <button
                    onClick={() => toggleMut.mutate({ id: job.id, enable: !job.isEnabled })}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      job.isEnabled ? "bg-emerald-500" : "bg-slate-600"
                    }`}
                    title={job.isEnabled ? "Disable" : "Enable"}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        job.isEnabled ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100 truncate">{job.name}</span>
                      {runStatusBadge(job.lastRunStatus)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{job.cronExpression}</span>
                      <span>{targetLabel(job.targetType)} / {actionLabel(job.action)}</span>
                      {job.nextRun && <span>Next: {relativeTime(job.nextRun)}</span>}
                      {job.lastRun && <span>Last: {relativeTime(job.lastRun)}</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden lg:flex items-center gap-4 text-xs text-slate-400">
                    <span>
                      <span className="text-emerald-400 font-medium">{job.totalRuns - job.failedRuns}</span>
                      {" "}ok
                    </span>
                    <span>
                      <span className="text-rose-400 font-medium">{job.failedRuns}</span>
                      {" "}fail
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => triggerMut.mutate(job.id)}
                      className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Trigger now"
                    >
                      <FaBolt size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(job)}
                      className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(job)}
                      className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded: run history */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-slate-700/50 pt-4">
                    <RunHistoryPanel jobId={job.id} jobName={job.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingJob ? "Edit Cron Job" : "Create Cron Job"}
        size="lg"
      >
        <CronJobForm
          initial={editingJob}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowFormModal(false)}
          isPending={createMut.isPending || updateMut.isPending}
        />
      </Modal>
    </div>
  );
}

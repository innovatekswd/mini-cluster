import React, { useState, useEffect } from "react";
import {
  FaDocker, FaPlus, FaTrash, FaSave, FaSync, FaEdit, FaTimes,
} from "react-icons/fa";
import {
  useContainerConfigQuery,
  useUpsertContainerConfigMutation,
  useRemoveContainerConfigMutation,
} from "~/hooks/useContainerQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import type { CreateContainerConfigDto, PortMapping, VolumeMount } from "~/types/PostMvpTypes";
import { ContainerRestartPolicy } from "~/types/PostMvpTypes";

interface Props {
  serviceId: string;
}

const restartPolicies = [
  { value: ContainerRestartPolicy.No, label: "No" },
  { value: ContainerRestartPolicy.Always, label: "Always" },
  { value: ContainerRestartPolicy.OnFailure, label: "On Failure" },
  { value: ContainerRestartPolicy.UnlessStopped, label: "Unless Stopped" },
];

const blankPort: PortMapping = { host: 0, container: 0, protocol: "tcp" };
const blankVol: VolumeMount = { host: "", container: "", readOnly: false };

export function ContainerConfigPanel({ serviceId }: Props) {
  const { data: config, isLoading } = useContainerConfigQuery(serviceId);
  const upsertMut = useUpsertContainerConfigMutation();
  const removeMut = useRemoveContainerConfigMutation();
  const { confirm } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CreateContainerConfigDto>({
    image: "",
    tag: "latest",
    restartPolicy: ContainerRestartPolicy.UnlessStopped,
    portMappings: [],
    volumeMounts: [],
    labels: {},
  });

  // Sync form from fetched config
  useEffect(() => {
    if (config) {
      setForm({
        image: config.image,
        tag: config.tag ?? "latest",
        registry: config.registry ?? "",
        containerName: config.containerName ?? "",
        hostname: config.hostname ?? "",
        networkMode: config.networkMode ?? "",
        privileged: config.privileged,
        user: config.user ?? "",
        memoryLimitBytes: config.memoryLimitBytes ?? undefined,
        cpuLimit: config.cpuLimit ?? undefined,
        portMappings: config.portMappings ?? [],
        volumeMounts: config.volumeMounts ?? [],
        labels: config.labels ?? {},
        restartPolicy: config.restartPolicy ?? ContainerRestartPolicy.No,
      });
    }
  }, [config]);

  const set = <K extends keyof CreateContainerConfigDto>(k: K, v: CreateContainerConfigDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    upsertMut.mutate(
      { serviceId, data: form },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "Remove Container Config",
      message: "This will delete all container configuration for this service.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (ok) removeMut.mutate(serviceId, { onSuccess: () => setEditing(false) });
  };

  // Port mapping helpers
  const addPort = () => set("portMappings", [...(form.portMappings ?? []), { ...blankPort }]);
  const removePort = (i: number) => set("portMappings", form.portMappings!.filter((_, idx) => idx !== i));
  const updatePort = (i: number, field: keyof PortMapping, val: string | number) => {
    const pm = [...(form.portMappings ?? [])];
    pm[i] = { ...pm[i], [field]: field === "protocol" ? val : Number(val) };
    set("portMappings", pm);
  };

  // Volume helpers
  const addVol = () => set("volumeMounts", [...(form.volumeMounts ?? []), { ...blankVol }]);
  const removeVol = (i: number) => set("volumeMounts", form.volumeMounts!.filter((_, idx) => idx !== i));
  const updateVol = (i: number, field: keyof VolumeMount, val: string | boolean) => {
    const vm = [...(form.volumeMounts ?? [])];
    vm[i] = { ...vm[i], [field]: val };
    set("volumeMounts", vm);
  };

  // Label helpers
  const labelEntries = Object.entries(form.labels ?? {});
  const addLabel = () => set("labels", { ...form.labels, "": "" });
  const removeLabel = (key: string) => {
    const copy = { ...form.labels };
    delete copy[key];
    set("labels", copy);
  };
  const updateLabel = (oldKey: string, newKey: string, val: string) => {
    const copy = { ...form.labels };
    delete copy[oldKey];
    copy[newKey] = val;
    set("labels", copy);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-6 w-40 rounded bg-slate-800/60" />
        <div className="h-20 rounded-lg bg-slate-800/60" />
      </div>
    );
  }

  // No config yet — show create button
  if (!config && !editing) {
    return (
      <section>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Container Config
        </h3>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
          <FaDocker className="mx-auto text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 mb-4">No container configuration set for this service.</p>
          <button
            onClick={() => { setEditing(true); setForm({ image: "", tag: "latest", restartPolicy: ContainerRestartPolicy.UnlessStopped, portMappings: [], volumeMounts: [], labels: {} }); }}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <FaPlus size={12} /> Configure Container
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Container Config
        </h3>
        {!editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors" title="Edit">
              <FaEdit size={12} />
            </button>
            <button onClick={handleRemove} className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors" title="Remove">
              <FaTrash size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={upsertMut.isPending || !form.image} className="px-3 py-1 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center gap-1 transition-colors">
              {upsertMut.isPending ? <FaSync className="animate-spin" size={10} /> : <FaSave size={10} />} Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors flex items-center gap-1">
              <FaTimes size={10} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
        {editing ? (
          <div className="p-4 space-y-4">
            {/* Image & Tag */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Image *</label>
                <input className="input-dark w-full text-sm" value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="nginx" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tag</label>
                <input className="input-dark w-full text-sm" value={form.tag ?? ""} onChange={(e) => set("tag", e.target.value)} placeholder="latest" />
              </div>
            </div>

            {/* Container Name & Network */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Container Name</label>
                <input className="input-dark w-full text-sm" value={form.containerName ?? ""} onChange={(e) => set("containerName", e.target.value)} placeholder="my-container" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Network Mode</label>
                <input className="input-dark w-full text-sm" value={form.networkMode ?? ""} onChange={(e) => set("networkMode", e.target.value)} placeholder="bridge" />
              </div>
            </div>

            {/* Restart Policy & Resources */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Restart Policy</label>
                <select className="input-dark w-full text-sm" title="Restart Policy" value={form.restartPolicy ?? 0} onChange={(e) => set("restartPolicy", Number(e.target.value))}>
                  {restartPolicies.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Memory Limit (MB)</label>
                <input type="number" className="input-dark w-full text-sm" value={form.memoryLimitBytes ? Math.round(form.memoryLimitBytes / (1024 * 1024)) : ""} onChange={(e) => set("memoryLimitBytes", e.target.value ? Number(e.target.value) * 1024 * 1024 : undefined)} placeholder="512" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">CPU Limit</label>
                <input type="number" step="0.1" className="input-dark w-full text-sm" value={form.cpuLimit ?? ""} onChange={(e) => set("cpuLimit", e.target.value ? Number(e.target.value) : undefined)} placeholder="1.0" />
              </div>
            </div>

            {/* Port Mappings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400 font-medium">Port Mappings</label>
                <button onClick={addPort} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><FaPlus size={10} /> Add Port</button>
              </div>
              {form.portMappings?.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input type="number" className="input-dark w-24 text-sm" placeholder="Host" value={p.host || ""} onChange={(e) => updatePort(i, "host", e.target.value)} />
                  <span className="text-slate-500">:</span>
                  <input type="number" className="input-dark w-24 text-sm" placeholder="Container" value={p.container || ""} onChange={(e) => updatePort(i, "container", e.target.value)} />
                  <select className="input-dark w-20 text-sm" title="Protocol" value={p.protocol} onChange={(e) => updatePort(i, "protocol", e.target.value)}>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                  <button onClick={() => removePort(i)} className="text-rose-400 hover:text-rose-300 p-1" title="Remove port"><FaTrash size={10} /></button>
                </div>
              ))}
            </div>

            {/* Volume Mounts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400 font-medium">Volume Mounts</label>
                <button onClick={addVol} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><FaPlus size={10} /> Add Volume</button>
              </div>
              {form.volumeMounts?.map((v, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input className="input-dark flex-1 text-sm" placeholder="Host path" value={v.host} onChange={(e) => updateVol(i, "host", e.target.value)} />
                  <span className="text-slate-500">:</span>
                  <input className="input-dark flex-1 text-sm" placeholder="Container path" value={v.container} onChange={(e) => updateVol(i, "container", e.target.value)} />
                  <label className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                    <input type="checkbox" checked={v.readOnly} onChange={(e) => updateVol(i, "readOnly", e.target.checked)} className="accent-cyan-500" /> RO
                  </label>
                  <button onClick={() => removeVol(i)} className="text-rose-400 hover:text-rose-300 p-1" title="Remove volume"><FaTrash size={10} /></button>
                </div>
              ))}
            </div>

            {/* Labels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400 font-medium">Labels</label>
                <button onClick={addLabel} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><FaPlus size={10} /> Add Label</button>
              </div>
              {labelEntries.map(([k, v], i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input className="input-dark flex-1 text-sm" placeholder="Key" value={k} onChange={(e) => updateLabel(k, e.target.value, v)} />
                  <span className="text-slate-500">=</span>
                  <input className="input-dark flex-1 text-sm" placeholder="Value" value={v} onChange={(e) => updateLabel(k, k, e.target.value)} />
                  <button onClick={() => removeLabel(k)} className="text-rose-400 hover:text-rose-300 p-1" title="Remove label"><FaTrash size={10} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Read-only view */
          <>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Image</span>
              <span className="text-slate-200 text-sm font-mono">{config!.image}:{config!.tag || "latest"}</span>
            </div>
            {config!.containerName && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-400 text-sm">Container Name</span>
                <span className="text-slate-200 text-sm font-mono">{config!.containerName}</span>
              </div>
            )}
            {config!.networkMode && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-400 text-sm">Network</span>
                <span className="text-slate-200 text-sm font-mono">{config!.networkMode}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Restart Policy</span>
              <span className="text-slate-200 text-sm">{restartPolicies.find(p => p.value === config!.restartPolicy)?.label ?? "No"}</span>
            </div>
            {(config!.portMappings?.length ?? 0) > 0 && (
              <div className="px-4 py-3">
                <span className="text-slate-400 text-sm block mb-1">Ports</span>
                <div className="flex flex-wrap gap-2">
                  {config!.portMappings!.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-300 font-mono">
                      {p.host}:{p.container}/{p.protocol}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(config!.volumeMounts?.length ?? 0) > 0 && (
              <div className="px-4 py-3">
                <span className="text-slate-400 text-sm block mb-1">Volumes</span>
                <div className="space-y-1">
                  {config!.volumeMounts!.map((v, i) => (
                    <div key={i} className="text-xs font-mono text-slate-300">
                      {v.host} → {v.container} {v.readOnly && <span className="text-amber-400">(RO)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {config!.memoryLimitBytes && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-400 text-sm">Memory Limit</span>
                <span className="text-slate-200 text-sm">{Math.round(config!.memoryLimitBytes / (1024 * 1024))} MB</span>
              </div>
            )}
            {config!.cpuLimit && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-400 text-sm">CPU Limit</span>
                <span className="text-slate-200 text-sm">{config!.cpuLimit}</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

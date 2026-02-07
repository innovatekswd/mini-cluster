import React, { useState } from "react";
import {
  FaSitemap, FaChevronRight, FaChevronDown, FaPlay, FaStop,
  FaSync, FaCircle, FaArrowRight, FaExchangeAlt,
} from "react-icons/fa";
import {
  useAppTreeQuery,
  useMoveAppMutation,
  useStartTreeMutation,
  useStopTreeMutation,
  useRestartTreeMutation,
} from "~/hooks/useTreeQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import type { AppTreeNode } from "~/types/PostMvpTypes";

// ── Tree Node ───────────────────────────────────────────────

interface TreeNodeProps {
  node: AppTreeNode;
  depth: number;
  onNavigate?: (appSlug: string) => void;
  flatApps: AppTreeNode[];
}

function TreeNode({ node, depth, onNavigate, flatApps }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [showMove, setShowMove] = useState(false);
  const moveMut = useMoveAppMutation();
  const startMut = useStartTreeMutation();
  const stopMut = useStopTreeMutation();
  const restartMut = useRestartTreeMutation();
  const { confirm } = useConfirm();
  const hasChildren = node.children && node.children.length > 0;

  const total = node.totalServices;
  const running = node.runningServices;
  const stopped = node.stoppedServices;
  const errors = node.errorServices;

  const healthColor =
    errors > 0
      ? "text-rose-400"
      : running === total && total > 0
      ? "text-emerald-400"
      : stopped === total
      ? "text-slate-500"
      : "text-amber-400";

  const handleStartTree = async () => {
    const ok = await confirm({
      title: "Start Tree",
      message: `Start "${node.name}" and all its child apps?`,
      confirmLabel: "Start",
      variant: "warning",
    });
    if (ok) startMut.mutate(node.id);
  };

  const handleStopTree = async () => {
    const ok = await confirm({
      title: "Stop Tree",
      message: `Stop "${node.name}" and all its child apps?`,
      confirmLabel: "Stop",
      variant: "danger",
    });
    if (ok) stopMut.mutate(node.id);
  };

  const handleMove = (newParentId: string | null) => {
    moveMut.mutate(
      { appId: node.id, newParentAppId: newParentId },
      { onSuccess: () => setShowMove(false) }
    );
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/30 group transition-colors"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 ${
            !hasChildren ? "invisible" : ""
          }`}
        >
          {expanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
        </button>

        {/* Icon */}
        <span className="text-lg select-none" title={node.name}>
          {node.icon || "📦"}
        </span>

        {/* Name */}
        <button
          onClick={() => onNavigate?.(node.slug)}
          className="font-medium text-slate-200 hover:text-cyan-400 transition-colors truncate text-sm text-left"
        >
          {node.name}
        </button>

        {/* Health dot */}
        <FaCircle className={`${healthColor} w-1.5 h-1.5`} />

        {/* Stats */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 ml-auto">
          {total > 0 && (
            <>
              <span className="text-emerald-400">{running}</span>
              <span>/</span>
              <span>{total}</span>
            </>
          )}
        </div>

        {/* Actions (on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          <button onClick={handleStartTree} title="Start tree" className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
            <FaPlay size={10} />
          </button>
          <button onClick={handleStopTree} title="Stop tree" className="p-1 text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
            <FaStop size={10} />
          </button>
          <button onClick={() => restartMut.mutate(node.id)} title="Restart tree" className="p-1 text-amber-400 hover:bg-amber-500/10 rounded transition-colors">
            <FaSync size={10} />
          </button>
          <button onClick={() => setShowMove(!showMove)} title="Move" className="p-1 text-slate-400 hover:bg-slate-700/50 rounded transition-colors">
            <FaExchangeAlt size={10} />
          </button>
        </div>
      </div>

      {/* Move dropdown */}
      {showMove && (
        <div
          className="mb-2 ml-12 p-3 rounded-lg bg-slate-800 border border-slate-700/50 max-w-xs"
          style={{ marginLeft: `${depth * 20 + 48}px` }}
        >
          <p className="text-xs text-slate-400 mb-2">Move "{node.name}" under:</p>
          <div className="space-y-1 max-h-32 overflow-auto">
            <button
              onClick={() => handleMove(null)}
              className="w-full text-left px-2 py-1 text-sm text-slate-300 hover:bg-slate-700/50 rounded"
            >
              <FaArrowRight size={10} className="inline mr-2 text-slate-500" /> Root (no parent)
            </button>
            {flatApps
              .filter((a) => a.id !== node.id)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleMove(a.id)}
                  className="w-full text-left px-2 py-1 text-sm text-slate-300 hover:bg-slate-700/50 rounded truncate"
                >
                  {a.icon || "📦"} {a.name}
                </button>
              ))}
          </div>
          <button
            onClick={() => setShowMove(false)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Services */}
      {expanded && node.services.length > 0 && (
        <div style={{ paddingLeft: `${(depth + 1) * 20 + 32}px` }}>
          {node.services.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400"
            >
              <FaCircle
                size={6}
                className={
                  svc.status?.toLowerCase() === "running"
                    ? "text-emerald-400"
                    : svc.status?.toLowerCase() === "failed"
                    ? "text-rose-400"
                    : "text-slate-600"
                }
              />
              <span className="truncate">{svc.name}</span>
              <span className="ml-auto capitalize text-slate-600">{svc.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Child nodes */}
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onNavigate={onNavigate}
            flatApps={flatApps}
          />
        ))}
    </div>
  );
}

// ── Flatten helper for move dropdown ────────────────────────

function flattenTree(nodes: AppTreeNode[]): AppTreeNode[] {
  const result: AppTreeNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenTree(n.children));
  }
  return result;
}

// ── Main Component ──────────────────────────────────────────

interface AppTreeViewProps {
  onNavigate?: (appSlug: string) => void;
}

export function AppTreeView({ onNavigate }: AppTreeViewProps) {
  const { data: tree = [], isLoading, refetch } = useAppTreeQuery();
  const flat = flattenTree(tree);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-800/60" style={{ marginLeft: `${i * 16}px` }} />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12">
        <FaSitemap className="mx-auto text-4xl text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">No apps to display in tree view.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <FaSitemap className="text-slate-500" />
          App Hierarchy
        </h3>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors"
          title="Refresh"
        >
          <FaSync size={12} />
        </button>
      </div>
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 py-2 max-h-[500px] overflow-auto">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            onNavigate={onNavigate}
            flatApps={flat}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { sessionsService, type SessionSpan, type SessionCorrelationResponse } from "~/services/sessionsService";
import { FaPlay, FaStop, FaRedo, FaExclamationTriangle } from "react-icons/fa";

interface SessionTimelineProps {
  /** Optional: pre-fetched correlation data (to avoid double-fetch if parent already has it) */
  correlationData?: SessionCorrelationResponse | null;
}

// Assign a deterministic color to each serviceId
const SERVICE_COLORS = [
  "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#3b82f6", "#14b8a6", "#f97316", "#a855f7",
];

function getServiceColor(serviceId: string, serviceIds: string[]): string {
  const idx = serviceIds.indexOf(serviceId);
  return SERVICE_COLORS[idx % SERVICE_COLORS.length];
}

export function SessionTimeline({ correlationData }: SessionTimelineProps) {
  const [data, setData] = useState<SessionCorrelationResponse | null>(correlationData ?? null);
  const [loading, setLoading] = useState(!correlationData);

  useEffect(() => {
    if (correlationData) {
      setData(correlationData);
      setLoading(false);
      return;
    }
    const from = new Date(Date.now() - 60 * 60 * 1000); // last hour
    sessionsService.getSessionCorrelation(from, new Date()).then((res) => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [correlationData]);

  const { spans, serviceIds, timeRange } = useMemo(() => {
    if (!data?.sessionSpans?.length) return { spans: [], serviceIds: [], timeRange: { min: 0, max: 0 } };
    const now = Date.now();
    const ids = [...new Set(data.sessionSpans.map((s) => s.serviceId))];
    const min = Math.min(...data.sessionSpans.map((s) => new Date(s.startTimestamp).getTime()));
    const max = Math.max(...data.sessionSpans.map((s) => s.endTimestamp ? new Date(s.endTimestamp).getTime() : now));
    return { spans: data.sessionSpans, serviceIds: ids, timeRange: { min, max } };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Loading session timeline...
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        No sessions in the last hour
      </div>
    );
  }

  const totalDuration = timeRange.max - timeRange.min || 1;
  const now = Date.now();
  const ROW_HEIGHT = 28;
  const LABEL_WIDTH = 120;

  // Group spans by serviceId — each service gets its own row
  const rows = serviceIds.map((sid) => ({
    serviceId: sid,
    sessions: spans.filter((s) => s.serviceId === sid),
  }));

  // Time axis ticks (5 ticks)
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const t = timeRange.min + (totalDuration * i) / 4;
    return { time: t, label: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
  });

  return (
    <div className="space-y-2">
      {/* Time axis */}
      <div className="flex" style={{ paddingLeft: LABEL_WIDTH }}>
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="text-[10px] text-slate-500"
            style={{ position: "absolute" as const, left: `${LABEL_WIDTH + ((tick.time - timeRange.min) / totalDuration) * (100 - 2)}%` }}
          >
            {tick.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="relative">
        {/* Time axis labels (absolute positioned) */}
        <div className="flex justify-between text-[10px] text-slate-500 mb-1" style={{ marginLeft: LABEL_WIDTH }}>
          {ticks.map((tick, i) => (
            <span key={i}>{tick.label}</span>
          ))}
        </div>

        {rows.map((row) => {
          const color = getServiceColor(row.serviceId, serviceIds);
          const label = row.sessions[0]?.commandLineArguments?.split("/").pop()?.split(" ")[0] || row.serviceId.slice(0, 8);

          return (
            <div key={row.serviceId} className="flex items-center" style={{ height: ROW_HEIGHT }}>
              {/* Service label */}
              <div
                className="text-xs text-slate-400 truncate shrink-0 pr-2"
                style={{ width: LABEL_WIDTH }}
                title={row.serviceId}
              >
                {label}
              </div>

              {/* Timeline bar area */}
              <div className="relative flex-1 h-4 bg-slate-800/30 rounded overflow-hidden">
                {row.sessions.map((session) => {
                  const start = new Date(session.startTimestamp).getTime();
                  const end = session.endTimestamp ? new Date(session.endTimestamp).getTime() : now;
                  const left = ((start - timeRange.min) / totalDuration) * 100;
                  const width = ((end - start) / totalDuration) * 100;
                  const isRunning = !session.endTimestamp;
                  const isFailed = session.exitCode !== null && session.exitCode !== 0;

                  return (
                    <div
                      key={session.sessionId}
                      className={`absolute inset-y-0 rounded-sm ${isRunning ? "animate-pulse" : ""}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 0.5)}%`,
                        backgroundColor: isFailed ? "#ef4444" : color,
                        opacity: isRunning ? 0.8 : 0.6,
                      }}
                      title={`${isRunning ? "Running" : isFailed ? "Failed" : "Stopped"} • ${new Date(session.startTimestamp).toLocaleTimeString()}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {serviceIds.map((sid) => {
          const color = getServiceColor(sid, serviceIds);
          const label = spans.find((s) => s.serviceId === sid)?.commandLineArguments?.split("/").pop()?.split(" ")[0] || sid.slice(0, 8);
          return (
            <div key={sid} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

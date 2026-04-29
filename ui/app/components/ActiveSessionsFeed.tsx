import { useState, useEffect } from "react";
import {
  sessionsService,
  eventTypeLabel,
  type LifecycleEvent,
  type SessionCorrelationResponse,
} from "~/services/sessionsService";
import { FaPlay, FaStop, FaRedo, FaExclamationTriangle, FaHistory } from "react-icons/fa";

interface ActiveSessionsFeedProps {
  correlationData?: SessionCorrelationResponse | null;
  maxItems?: number;
}

const EVENT_ICONS: Record<number, React.ReactNode> = {
  0: <FaPlay className="text-emerald-400" />,
  1: <FaStop className="text-slate-400" />,
  2: <FaRedo className="text-cyan-400" />,
  3: <FaExclamationTriangle className="text-rose-400" />,
};

const EVENT_COLORS: Record<number, string> = {
  0: "border-emerald-500/30",
  1: "border-slate-600/30",
  2: "border-cyan-500/30",
  3: "border-rose-500/30",
};

export function ActiveSessionsFeed({ correlationData, maxItems = 10 }: ActiveSessionsFeedProps) {
  const [events, setEvents] = useState<LifecycleEvent[]>(correlationData?.recentEvents ?? []);
  const [loading, setLoading] = useState(!correlationData);

  useEffect(() => {
    if (correlationData) {
      setEvents(correlationData.recentEvents ?? []);
      setLoading(false);
      return;
    }
    const from = new Date(Date.now() - 60 * 60 * 1000);
    sessionsService.getSessionCorrelation(from, new Date()).then((res) => {
      setEvents(res.recentEvents ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [correlationData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Loading events...
      </div>
    );
  }

  const displayed = events.slice(0, maxItems);

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-sm gap-2">
        <FaHistory className="text-lg" />
        No recent events
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
      {displayed.map((evt) => {
        const time = new Date(evt.timestamp);
        const ago = formatTimeAgo(time);
        return (
          <div
            key={evt.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-slate-800/30 ${EVENT_COLORS[evt.eventType] ?? "border-slate-700/30"}`}
          >
            <span className="text-sm shrink-0">{EVENT_ICONS[evt.eventType] ?? <FaHistory className="text-slate-500" />}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-300 font-medium">
                {eventTypeLabel(evt.eventType)}
              </span>
              <span className="text-xs text-slate-500 ml-1.5">{evt.serviceId.slice(0, 8)}</span>
              {evt.exitCode !== null && evt.exitCode !== 0 && (
                <span className="text-[10px] text-rose-400 ml-1.5">exit {evt.exitCode}</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">{ago}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

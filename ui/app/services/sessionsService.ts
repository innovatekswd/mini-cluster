import apiClient from "~/lib/apiClient";

export interface SessionInfo {
  sessionId: string;
  serviceId: string;
  startTimestamp: string;
  endTimestamp: string | null;
  autoStart: boolean;
  exitReason: string | null;
  exitCode: number | null;
  workingDirectory: string | null;
  commandLineArguments: string | null;
  lineCount: number;
  durationSeconds: number | null;
}

export interface SessionListResponse {
  total: number;
  page: number;
  pageSize: number;
  sessions: SessionInfo[];
}

export interface SessionLogEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  logType: string;
  line: string;
}

export interface SessionLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  results: SessionLogEntry[];
}

export interface SessionSpan {
  sessionId: string;
  serviceId: string;
  startTimestamp: string;
  endTimestamp: string | null;
  exitCode: number | null;
  exitReason: string | null;
  commandLineArguments: string | null;
}

export interface LifecycleEvent {
  id: string;
  serviceId: string;
  eventType: number; // 0=Started, 1=Stopped, 2=Restarted, 3=Failed
  timestamp: string;
  triggeredBy: string | null;
  exitCode: number | null;
}

export interface SessionCorrelationResponse {
  sessionSpans: SessionSpan[];
  recentEvents: LifecycleEvent[];
}

export const sessionsService = {
  async getSessions(
    serviceId: string,
    page = 1,
    pageSize = 20,
    from?: Date,
    to?: Date
  ): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("pageSize", pageSize.toString());
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());

    const res = await apiClient.get(
      `/api/services/${serviceId}/sessions?${params.toString()}`
    );
    const raw = res.data;
    // Handle both paginated response { total, sessions } and plain array
    if (Array.isArray(raw)) {
      return { total: raw.length, page: 1, pageSize: raw.length, sessions: raw };
    }
    return raw as SessionListResponse;
  },

  async getSessionLogs(
    serviceId: string,
    sessionId: string,
    page = 1,
    pageSize = 500,
    query?: string,
    type?: string
  ): Promise<SessionLogsResponse> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("pageSize", pageSize.toString());
    if (query) params.append("query", query);
    if (type) params.append("type", type);

    const res = await apiClient.get(
      `/api/services/${serviceId}/sessions/${sessionId}/logs?${params.toString()}`
    );
    const raw = res.data;
    // Handle both paginated { total, results } and plain array
    if (Array.isArray(raw)) {
      return { total: raw.length, page: 1, pageSize: raw.length, results: raw };
    }
    return {
      total: raw?.total ?? 0,
      page: raw?.page ?? 1,
      pageSize: raw?.pageSize ?? pageSize,
      results: raw?.results ?? [],
    } as SessionLogsResponse;
  },

  async getSessionCorrelation(
    from?: Date,
    to?: Date
  ): Promise<SessionCorrelationResponse> {
    const params = new URLSearchParams();
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());

    try {
      const res = await apiClient.get<SessionCorrelationResponse>(
        `/api/metrics/system/sessions?${params.toString()}`
      );
      return res.data;
    } catch {
      return { sessionSpans: [], recentEvents: [] };
    }
  },
};

// Helper: format session duration
export function formatSessionDuration(seconds: number | null): string {
  if (seconds === null) return "Running...";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Helper: event type label
export function eventTypeLabel(eventType: number): string {
  return ["Started", "Stopped", "Restarted", "Failed"][eventType] ?? "Unknown";
}

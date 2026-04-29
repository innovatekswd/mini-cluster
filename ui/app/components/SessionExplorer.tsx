import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  sessionsService,
  formatSessionDuration,
  type SessionInfo,
  type SessionLogEntry,
} from "~/services/sessionsService";
import {
  FaHistory,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaPlay,
  FaStop,
  FaExclamationTriangle,
  FaTerminal,
  FaSync,
  FaDownload,
  FaClock,
  FaFilter,
} from "react-icons/fa";
import Editor from "@monaco-editor/react";

interface SessionExplorerProps {
  serviceId: string;
  serviceName?: string;
}

export function SessionExplorer({ serviceId, serviceName }: SessionExplorerProps) {
  // Session list state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Selected session + logs state
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // Filters
  const [logSearch, setLogSearch] = useState("");
  const [logType, setLogType] = useState<"all" | "stdout" | "stderr">("all");

  // Global search across sessions
  const [globalSearch, setGlobalSearch] = useState("");

  // Load sessions
  const loadSessions = useCallback(async (page: number) => {
    setSessionsLoading(true);
    try {
      const data = await sessionsService.getSessions(serviceId, page, 10);
      const list = data.sessions ?? [];
      setSessions(list);
      setTotalSessions(data.total ?? list.length);
      setSessionPage(page);
      if (list.length > 0 && !selectedSession) {
        setSelectedSession(list[0]);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [serviceId, selectedSession]);

  // Load session logs
  const loadSessionLogs = useCallback(async (sessionId: string, page: number, search?: string, type?: string) => {
    setLogsLoading(true);
    try {
      const data = await sessionsService.getSessionLogs(
        serviceId,
        sessionId,
        page,
        500,
        search || undefined,
        type && type !== "all" ? type : undefined
      );
      setSessionLogs(data.results ?? []);
      setLogsTotal(data.total ?? 0);
      setLogsPage(page);
    } catch (err) {
      console.error("Failed to load session logs:", err);
      setSessionLogs([]);
      setLogsTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }, [serviceId]);

  // Initial load
  useEffect(() => {
    loadSessions(1);
  }, [serviceId]);

  // Load logs when selected session changes
  useEffect(() => {
    if (selectedSession) {
      loadSessionLogs(selectedSession.sessionId, 1);
      setLogSearch("");
      setLogType("all");
    }
  }, [selectedSession?.sessionId, loadSessionLogs]);

  // Handle session log search
  const handleLogSearch = useCallback(() => {
    if (selectedSession) {
      loadSessionLogs(selectedSession.sessionId, 1, logSearch, logType);
    }
  }, [selectedSession, logSearch, logType, loadSessionLogs]);

  // Refresh when log type filter changes
  useEffect(() => {
    if (selectedSession) {
      loadSessionLogs(selectedSession.sessionId, 1, logSearch, logType);
    }
  }, [logType]);

  // Formatted log text for Monaco
  const formattedLogs = useMemo(() => {
    return [...(sessionLogs || [])]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 } as any);
        const type = l.logType === "stderr" ? "ERR" : "OUT";
        return `${time} [${type}] ${l.line}`;
      })
      .join("\n");
  }, [sessionLogs]);

  const totalLogPages = Math.ceil(logsTotal / 500);
  const totalSessionPages = Math.ceil(totalSessions / 10);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session List */}
      <div className="flex-none border-b border-slate-700/50 bg-slate-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaHistory className="text-violet-400" />
            <span className="text-sm font-semibold text-slate-200">Sessions</span>
            <span className="text-xs text-slate-500">({totalSessions} total)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSessions(sessionPage)}
              className="icon-btn text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <FaSync size={12} className={sessionsLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Session cards - horizontal scroll */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-thin">
          {sessionsLoading && sessions.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-500 py-4">
              <FaSync className="animate-spin" size={12} />
              <span className="text-sm">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-slate-500 py-4">No sessions found</div>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                isSelected={selectedSession?.sessionId === session.sessionId}
                onClick={() => setSelectedSession(session)}
              />
            ))
          )}
        </div>

        {/* Session pagination */}
        {totalSessionPages > 1 && (
          <div className="px-4 pb-2 flex items-center justify-center gap-2">
            <button
              onClick={() => loadSessions(sessionPage - 1)}
              disabled={sessionPage <= 1}
              className="icon-btn text-xs disabled:opacity-30"
            >
              <FaChevronLeft size={10} />
            </button>
            <span className="text-xs text-slate-500">
              {sessionPage} / {totalSessionPages}
            </span>
            <button
              onClick={() => loadSessions(sessionPage + 1)}
              disabled={sessionPage >= totalSessionPages}
              className="icon-btn text-xs disabled:opacity-30"
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Selected Session Logs */}
      {selectedSession && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Session detail header */}
          <div className="flex-none px-4 py-2 bg-slate-800/30 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <StatusIcon session={selectedSession} />
              <div>
                <span className="text-sm font-medium text-slate-200">
                  Session #{sessions.indexOf(selectedSession) + 1 + (sessionPage - 1) * 10}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  {new Date(selectedSession.startTimestamp).toLocaleString()}
                  {selectedSession.endTimestamp && (
                    <> → {new Date(selectedSession.endTimestamp).toLocaleTimeString()}</>
                  )}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {formatSessionDuration(selectedSession.durationSeconds ?? null)}
              </span>
              <span className="text-xs text-slate-500">
                {(selectedSession.lineCount ?? 0).toLocaleString()} lines
              </span>
            </div>

            {/* Log search / filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={10} />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogSearch()}
                  placeholder="Search in session..."
                  className="bg-slate-700/50 text-slate-100 pl-7 pr-7 py-1.5 rounded-md text-xs
                    border border-slate-600/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 w-48"
                />
                {logSearch && (
                  <button
                    onClick={() => { setLogSearch(""); if (selectedSession) loadSessionLogs(selectedSession.sessionId, 1, "", logType); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <FaTimes size={10} />
                  </button>
                )}
              </div>

              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as "all" | "stdout" | "stderr")}
                className="bg-slate-700/50 text-slate-300 px-2 py-1.5 rounded-md border border-slate-600/50 text-xs"
              >
                <option value="all">All</option>
                <option value="stdout">stdout</option>
                <option value="stderr">stderr</option>
              </select>

              <button
                onClick={handleLogSearch}
                disabled={logsLoading}
                className="icon-btn text-violet-400 hover:bg-violet-500/10"
                title="Search"
              >
                {logsLoading ? <FaSync size={12} className="animate-spin" /> : <FaSearch size={12} />}
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([formattedLogs], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `session-${selectedSession.sessionId.slice(0, 8)}-logs.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="icon-btn text-cyan-400 hover:bg-cyan-500/10"
                title="Download logs"
              >
                <FaDownload size={12} />
              </button>
            </div>
          </div>

          {/* Log viewer */}
          <div className="flex-1 relative min-h-0">
            {logsLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <FaSync className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            ) : sessionLogs.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                <FaTerminal className="w-10 h-10 mb-3 text-slate-600" />
                <p className="text-sm">No logs found</p>
              </div>
            ) : (
              <Editor
                className="absolute inset-0"
                defaultLanguage="output"
                value={formattedLogs}
                theme="minicluster-console"
                beforeMount={(monaco) => {
                  try {
                    monaco.editor.defineTheme("minicluster-console", {
                      base: "vs-dark",
                      inherit: true,
                      rules: [
                        { token: "log.error", foreground: "F87171", fontStyle: "bold" },
                        { token: "log.warning", foreground: "FBBF24" },
                        { token: "log.info", foreground: "34D399" },
                        { token: "log.debug", foreground: "6B7280" },
                        { token: "log.stacktrace", foreground: "94A3B8" },
                        { token: "log.time", foreground: "38BDF8" },
                      ],
                      colors: {
                        "editor.background": "#0f172a",
                        "editor.foreground": "#e2e8f0",
                        "editor.lineHighlightBackground": "#1e293b",
                        "editorLineNumber.foreground": "#475569",
                        "editorGutter.background": "#0f172a",
                      },
                    });
                  } catch { /* theme already defined */ }

                  if (!monaco.languages.getLanguages().find((l: any) => l.id === "output")) {
                    monaco.languages.register({ id: "output" });
                    monaco.languages.setMonarchTokensProvider("output", {
                      tokenizer: {
                        root: [
                          [/\b(ERROR|FAIL|EXCEPTION|FATAL|CRITICAL).*/, "log.error"],
                          [/\b(WARN|WARNING).*/, "log.warning"],
                          [/\b(INFO|INFORMATION).*/, "log.info"],
                          [/\b(DEBUG|TRACE|VERBOSE).*/, "log.debug"],
                          [/\s+at\s+[\w.<>]+\(.*\)/, "log.stacktrace"],
                          [/\d{2}:\d{2}:\d{2}/, "log.time"],
                        ],
                      },
                    });
                  }
                }}
                onMount={(editor) => {
                  if (sessionLogs.length > 0) {
                    setTimeout(() => editor.revealLine(sessionLogs.length), 100);
                  }
                }}
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  wordWrap: "on",
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  renderWhitespace: "none",
                  padding: { top: 8, bottom: 8 },
                  folding: false,
                  glyphMargin: false,
                }}
              />
            )}
          </div>

          {/* Pagination */}
          {totalLogPages > 1 && (
            <div className="flex-none px-4 py-2 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {logsTotal.toLocaleString()} lines total
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedSession && loadSessionLogs(selectedSession.sessionId, logsPage - 1, logSearch, logType)}
                  disabled={logsPage <= 1}
                  className="icon-btn text-xs disabled:opacity-30"
                >
                  <FaChevronLeft size={10} />
                </button>
                <span className="text-xs text-slate-400">
                  Page {logsPage} of {totalLogPages}
                </span>
                <button
                  onClick={() => selectedSession && loadSessionLogs(selectedSession.sessionId, logsPage + 1, logSearch, logType)}
                  disabled={logsPage >= totalLogPages}
                  className="icon-btn text-xs disabled:opacity-30"
                >
                  <FaChevronRight size={10} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No session selected */}
      {!selectedSession && !sessionsLoading && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <FaHistory className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-lg font-medium">No Sessions</p>
            <p className="text-sm mt-1">Session data will appear here after you run the service.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SessionCard({ session, isSelected, onClick }: { session: SessionInfo; isSelected: boolean; onClick: () => void }) {
  const isRunning = !session.endTimestamp;
  const hasFailed = session.exitCode !== null && session.exitCode !== 0;

  return (
    <button
      onClick={onClick}
      className={`flex-none p-3 rounded-lg border transition-all min-w-[200px] text-left ${
        isSelected
          ? "bg-violet-500/20 border-violet-500/50 ring-1 ring-violet-500/30"
          : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <StatusIcon session={session} />
        <span className="text-xs font-medium text-slate-200 truncate">
          {new Date(session.startTimestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" "}
          {new Date(session.startTimestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <FaClock size={9} />
          {formatSessionDuration(session.durationSeconds ?? null)}
        </span>
        <span>{(session.lineCount ?? 0).toLocaleString()} lines</span>
      </div>
      {session.exitCode !== null && (
        <div className={`text-xs mt-1 ${hasFailed ? "text-rose-400" : "text-emerald-400"}`}>
          exit {session.exitCode}
        </div>
      )}
    </button>
  );
}

function StatusIcon({ session }: { session: SessionInfo }) {
  const isRunning = !session.endTimestamp;
  const hasFailed = session.exitCode !== null && session.exitCode !== 0;

  if (isRunning) {
    return <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />;
  }
  if (hasFailed) {
    return <FaExclamationTriangle className="text-rose-400" size={10} />;
  }
  return <FaStop className="text-slate-500" size={10} />;
}

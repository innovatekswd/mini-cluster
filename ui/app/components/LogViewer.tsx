// app/components/LogViewer.tsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import type { LogViewerProps } from "../types/LogViewerProps";
import { useLogContext } from "../context/LogContext";
import { FaDownload, FaTrash, FaFilter, FaSearch, FaTerminal, FaTimes, FaDatabase, FaStream, FaSync, FaGlobe } from "react-icons/fa";
import apiClient from "~/lib/apiClient";
import { withRetry } from "~/lib/retry";
import { serviceService } from "../services/appService";

interface DbSearchResult {
  id: number;
  sessionId: string;
  type: string;
  timestamp: string;
  line: string;
}

interface DbSearchResponse {
  total: number;
  page: number;
  pageSize: number;
  maxPageSize: number;
  results: DbSearchResult[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ appId, miniView = false, refreshKey = 0 }) => {
  const { logs, clearLogs, addLog } = useLogContext();
  const appLogs = logs[appId] || [];
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"live" | "db">("live");
  const [dbSearchResults, setDbSearchResults] = useState<DbSearchResult[]>([]);
  const [dbSearchLoading, setDbSearchLoading] = useState(false);
  const [dbSearchTotal, setDbSearchTotal] = useState(0);
  const [dbSearchPage, setDbSearchPage] = useState(1);
  const [dbSearchQuery, setDbSearchQuery] = useState("");
  const [logType, setLogType] = useState<"all" | "stdout" | "stderr">("all");
  const [sessionScope, setSessionScope] = useState<"latest" | "all">("latest");
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load recent logs from DB on mount ONLY when no live SignalR logs exist.
  // This is a fallback for stopped services — live logs come via SignalR "LogEntry".
  // We do NOT re-fetch on refreshKey changes; SignalR handles real-time updates.
  useEffect(() => {
    if (!appId || initialLoadDone) return;

    // If SignalR is already providing live logs, skip DB fetch entirely
    if (appLogs.length > 0) {
      setInitialLoadDone(true);
      return;
    }
    
    const controller = new AbortController();

    const loadRecentLogs = async () => {
      try {
        await withRetry(
          async () => {
            const params = new URLSearchParams();
            params.append("page", "1");
            params.append("pageSize", "200");

            const response = await apiClient.get<DbSearchResponse>(
              `/api/services/${appId}/logs/search?${params.toString()}`,
              { signal: controller.signal }
            );

            if (response.data.results && response.data.results.length > 0) {
              const sortedLogs = response.data.results
                .filter(r => r && r.timestamp && r.line !== undefined)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

              sortedLogs.forEach(r => {
                const time = new Date(r.timestamp).toLocaleTimeString();
                const type = r.type === "stderr" ? "[ERR]" : "[OUT]";
                addLog(appId, `${time} ${type} ${r.line}`);
              });
            }
          },
          {
            maxRetries: 3,
            initialDelay: 500,
            backoffMultiplier: 2,
            maxDelay: 4_000,
            signal: controller.signal,
          }
        );
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error("Error loading recent logs:", error);
        }
      } finally {
        setInitialLoadDone(true);
      }
    };

    // Small delay to let SignalR ReplayLogs arrive first
    const timer = setTimeout(loadRecentLogs, 1_500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [appId, initialLoadDone, addLog, appLogs.length]);

  // Search DB logs
  const searchDbLogs = useCallback(async (query: string, page: number = 1) => {
    if (!appId) return;
    
    setDbSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (logType !== "all") params.append("type", logType);
      if (sessionScope !== "latest") params.append("sessionId", sessionScope);
      params.append("page", page.toString());
      params.append("pageSize", "500");
      
      const response = await apiClient.get<DbSearchResponse>(
        `/api/services/${appId}/logs/search?${params.toString()}`
      );
      
      setDbSearchResults(response.data.results);
      setDbSearchTotal(response.data.total);
      setDbSearchPage(page);
    } catch (error) {
      console.error("Error searching DB logs:", error);
      setDbSearchResults([]);
    } finally {
      setDbSearchLoading(false);
    }
  }, [appId, logType, sessionScope]);

  // Handle DB search on Enter key
  const handleDbSearch = useCallback(() => {
    setDbSearchQuery(search);
    searchDbLogs(search, 1);
  }, [search, searchDbLogs]);

  // Refresh DB search when log type or session scope changes
  useEffect(() => {
    if (searchMode === "db" && dbSearchQuery !== undefined) {
      searchDbLogs(dbSearchQuery, 1);
    }
  }, [logType, sessionScope, searchMode]);

  // Initial load of DB logs when switching to DB mode
  useEffect(() => {
    if (searchMode === "db" && dbSearchResults.length === 0 && !dbSearchLoading) {
      searchDbLogs("", 1);
    }
  }, [searchMode]);

  // Filter live logs
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return appLogs;
    return appLogs.filter((line) =>
      line.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, appLogs]);

  // Format DB logs for display
  const formattedDbLogs = useMemo(() => {
    if (!dbSearchResults || !Array.isArray(dbSearchResults)) return [];
    return dbSearchResults
      .filter(r => r && r.timestamp && r.line !== undefined)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(r => {
        const time = new Date(r.timestamp).toLocaleTimeString();
        const type = r.logType === "stderr" ? "[ERR]" : "[OUT]";
        return `${time} ${type} ${r.line}`;
      });
  }, [dbSearchResults]);

  const displayLogs = searchMode === "live" ? filteredLogs : formattedDbLogs;
  const totalCount = searchMode === "live" ? appLogs.length : dbSearchTotal;
  const displayCount = searchMode === "live" ? filteredLogs.length : dbSearchResults.length;

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700/50">
      {/* Header toolbar */}
      <div className="flex-none px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left side - Mode Toggle + Search */}
        <div className="flex items-center gap-3 flex-1">
          {/* Mode Toggle */}
          <div className="flex bg-slate-700/50 rounded-lg p-0.5">
            <button
              onClick={() => setSearchMode("live")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                searchMode === "live" 
                  ? "bg-cyan-600 text-white" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Live logs (in memory)"
            >
              <FaStream size={10} />
              <span className="hidden sm:inline">Live</span>
            </button>
            <button
              onClick={() => setSearchMode("db")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                searchMode === "db" 
                  ? "bg-violet-600 text-white" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Search database logs"
            >
              <FaDatabase size={10} />
              <span className="hidden sm:inline">DB</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchMode === "db") {
                  handleDbSearch();
                }
              }}
              placeholder={searchMode === "live" ? "Filter logs..." : "Search database... (Enter)"}
              className="w-full bg-slate-700/50 text-slate-100 pl-9 pr-8 py-2 rounded-lg
                placeholder-slate-500 border border-slate-600/50
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
                transition-all duration-200"
              aria-label="Search logs"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  if (searchMode === "db") {
                    setDbSearchQuery("");
                    searchDbLogs("", 1);
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300
                  p-1 rounded-md hover:bg-slate-600/50 transition-colors"
              >
                <FaTimes size={12} />
              </button>
            )}
          </div>

          {/* Log Type Filter (DB mode only) */}
          {searchMode === "db" && (
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as "all" | "stdout" | "stderr")}
              className="bg-slate-700/50 text-slate-300 px-3 py-2 rounded-lg border border-slate-600/50 text-xs"
            >
              <option value="all">All Types</option>
              <option value="stdout">stdout</option>
              <option value="stderr">stderr</option>
            </select>
          )}

          {/* Session Scope (DB mode only) */}
          {searchMode === "db" && (
            <select
              value={sessionScope}
              onChange={(e) => setSessionScope(e.target.value as "latest" | "all")}
              className="bg-slate-700/50 text-slate-300 px-3 py-2 rounded-lg border border-slate-600/50 text-xs"
            >
              <option value="latest">Latest Session</option>
              <option value="all">All Sessions</option>
            </select>
          )}

          {/* DB Search Button */}
          {searchMode === "db" && (
            <button
              onClick={handleDbSearch}
              disabled={dbSearchLoading}
              className="icon-btn flex items-center justify-center text-violet-400 hover:bg-violet-500/10"
              title="Search"
            >
              {dbSearchLoading ? (
                <FaSync size={14} className="animate-spin" />
              ) : (
                <FaSearch size={14} />
              )}
            </button>
          )}
        </div>

        {/* Middle - Log count indicator */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
          <FaTerminal className={searchMode === "live" ? "text-cyan-500" : "text-violet-500"} size={14} />
          <span>
            {displayCount !== totalCount ? (
              <>{displayCount} / {totalCount} lines</>
            ) : (
              <>{totalCount} lines</>
            )}
            {searchMode === "db" && dbSearchTotal > 500 && (
              <span className="text-xs text-slate-500 ml-1">(showing max 500)</span>
            )}
          </span>
        </div>
        
        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            className="icon-btn flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10"
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                if (searchMode === "live") {
                  // Clear live logs and reload from DB
                  clearLogs(appId);
                  setInitialLoadDone(false);
                } else {
                  // Re-run current DB search
                  await searchDbLogs(dbSearchQuery, 1);
                }
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing || dbSearchLoading}
            aria-label="Refresh logs"
            title={searchMode === "live" ? "Reload logs from database" : "Refresh search results"}
          >
            <FaSync size={14} className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
          </button>
          <button
            className="icon-btn flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10"
            onClick={() => {
              const logsToDownload = searchMode === "live" ? appLogs : formattedDbLogs;
              const blob = new Blob([logsToDownload.join("\n")], {
                type: "text/plain;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `logs-${appId}-${new Date().toISOString().slice(0,10)}.txt`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            aria-label="Download logs"
          >
            <FaDownload size={14} aria-hidden="true" />
          </button>
          <button
            className="icon-btn flex items-center justify-center text-rose-400 hover:bg-rose-500/10"
            onClick={async () => {
              if (!confirm("Delete all logs from database and memory? This cannot be undone.")) return;
              try {
                await serviceService.deleteServiceLogs(appId);
                clearLogs(appId);
                if (searchMode === "db") {
                  await searchDbLogs(dbSearchQuery, 1);
                } else {
                  setInitialLoadDone(false);
                }
              } catch (error) {
                console.error("Failed to delete logs:", error);
                alert("Failed to delete logs. Please try again.");
              }
            }}
            aria-label="Delete logs"
            title="Delete all logs from database and memory"
          >
            <FaTrash size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editor container */}
      <div className="flex-1 relative min-h-0">
        {displayLogs.length === 0 && !dbSearchLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <FaTerminal className="w-12 h-12 mb-4 text-slate-600" />
            <p className="text-lg font-medium">
              {searchMode === "live" ? "No logs yet" : "No logs found"}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {searchMode === "live" 
                ? "Logs will appear here when the service runs"
                : "Try a different search query or time range"
              }
            </p>
          </div>
        ) : dbSearchLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <FaSync className="w-8 h-8 mb-4 text-violet-500 animate-spin" />
            <p className="text-sm text-slate-400">Searching database...</p>
          </div>
        ) : (
          <Editor
            className="absolute inset-0"
            defaultLanguage="output"
            value={displayLogs.join("\n")}
            theme="vs-dark"
            beforeMount={(monaco) => {
              // Define a custom theme optimized for console output
              monaco.editor.defineTheme('minicluster-console', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                  // Highlighting for log levels
                  { token: 'log.error', foreground: 'F87171', fontStyle: 'bold' },
                  { token: 'log.warning', foreground: 'FBBF24' },
                  { token: 'log.info', foreground: '34D399' },
                  { token: 'log.debug', foreground: '6B7280' },
                  // .NET specific highlights
                  { token: 'log.exception', foreground: 'F87171', fontStyle: 'bold' },
                  { token: 'log.stacktrace', foreground: '94A3B8' },
                  { token: 'log.path', foreground: 'A78BFA' },
                  { token: 'log.time', foreground: '38BDF8' }
                ],
                colors: {
                  'editor.background': '#0f172a',
                  'editor.foreground': '#e2e8f0',
                  'editorCursor.foreground': '#38BDF8',
                  'editor.lineHighlightBackground': '#1e293b',
                  'editorLineNumber.foreground': '#475569',
                  'editorLineNumber.activeForeground': '#94A3B8',
                  'editor.selectionBackground': '#0e7490',
                  'editor.inactiveSelectionBackground': '#164e63',
                  'editorGutter.background': '#0f172a',
                },
              });

              // Register a language provider to highlight .NET console output
              monaco.languages.register({ id: 'output' });
              monaco.languages.setMonarchTokensProvider('output', {
                tokenizer: {
                  root: [
                    // Match error lines
                    [/\b(ERROR|FAIL|EXCEPTION|FATAL|CRITICAL).*/, 'log.error'],
                    // Match warning lines
                    [/\b(WARN|WARNING).*/, 'log.warning'],
                    // Match info lines
                    [/\b(INFO|INFORMATION).*/, 'log.info'],
                    // Match debug/trace lines
                    [/\b(DEBUG|TRACE|VERBOSE).*/, 'log.debug'],
                    // Match exception stack traces
                    [/\s+at\s+[\w\.<>]+\(.*\)/, 'log.stacktrace'],
                    [/^[\s-]*Exception:.*$/, 'log.exception'],
                    // Match file paths
                    [/[a-zA-Z]:\\[\w\\.\-_]+/, 'log.path'],
                    [/\/[\w\/.\-_]+/, 'log.path'],
                    // Match timestamps
                    [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/, 'log.time'],
                    [/\d{2}:\d{2}:\d{2}.\d{3}/, 'log.time'],
                  ]
                }
              });
            }}
            onMount={(editor, monaco) => {
              monaco.editor.setTheme('minicluster-console');
              
              // Scroll to the bottom when logs change
              if (displayLogs.length > 0) {
                setTimeout(() => {
                  editor.revealLine(displayLogs.length);
                }, 100);
              }
              
              // Ensure editor updates its layout
              setTimeout(() => editor.layout(), 0);
            }}
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollbar: { 
                vertical: "visible", 
                horizontalSliderSize: 8, 
                verticalSliderSize: 8,
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              wordWrap: "on",
              automaticLayout: true,
              renderWhitespace: "none",
              overviewRulerBorder: false,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "line",
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              lineDecorationsWidth: 8,
              folding: false,
              glyphMargin: false,
            }}
          />
        )}
      </div>
    </div>
  );
};

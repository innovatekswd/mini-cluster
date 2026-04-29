import React, { createContext, useCallback, useContext, useState, useRef } from "react";

export interface LogEntry {
  timestamp: string;
  type: "stdout" | "stderr" | "info";
  line: string;
  sessionId?: string;
}

interface LogContextType {
  /** Backward-compatible: flat string arrays per service */
  logs: Record<string, string[]>;
  /** Structured log entries per service (with timestamp, type, sessionId) */
  logEntries: Record<string, LogEntry[]>;
  /** Current session ID per service */
  currentSessionIds: Record<string, string>;

  addLog: (appId: string, log: string) => void;
  addStructuredLog: (appId: string, entry: LogEntry) => void;
  addStructuredLogs: (appId: string, entries: LogEntry[]) => void;
  setCurrentSessionId: (appId: string, sessionId: string) => void;
  clearLogs: (appId: string) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

const MAX_LOG_ENTRIES = 5000;

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [logEntries, setLogEntries] = useState<Record<string, LogEntry[]>>({});
  const [currentSessionIds, setCurrentSessionIds] = useState<Record<string, string>>({});
  // Track known lines to prevent duplicates during replay
  const seenLinesRef = useRef<Record<string, Set<string>>>({});

  const makeKey = (entry: LogEntry) => `${entry.timestamp}|${entry.line}`;

  const addLog = useCallback((appId: string, log: string) => {
    setLogs(prev => {
      const currentLogs = prev[appId] || [];
      const updatedLogs = [...currentLogs, log];
      return { ...prev, [appId]: updatedLogs.length > MAX_LOG_ENTRIES ? updatedLogs.slice(-MAX_LOG_ENTRIES) : updatedLogs };
    });
  }, []);

  const addStructuredLog = useCallback((appId: string, entry: LogEntry) => {
    const key = makeKey(entry);
    if (!seenLinesRef.current[appId]) seenLinesRef.current[appId] = new Set();
    if (seenLinesRef.current[appId].has(key)) return;
    seenLinesRef.current[appId].add(key);
    // Cap the seen-set to prevent unbounded growth
    if (seenLinesRef.current[appId].size > MAX_LOG_ENTRIES * 2) {
      const arr = Array.from(seenLinesRef.current[appId]);
      seenLinesRef.current[appId] = new Set(arr.slice(-MAX_LOG_ENTRIES));
    }

    setLogEntries(prev => {
      const current = prev[appId] || [];
      const updated = [...current, entry];
      return { ...prev, [appId]: updated.length > MAX_LOG_ENTRIES ? updated.slice(-MAX_LOG_ENTRIES) : updated };
    });

    // Also add to flat logs for backward compatibility
    const type = entry.type === "stderr" ? "[ERR]" : "[OUT]";
    const time = new Date(entry.timestamp).toLocaleTimeString();
    setLogs(prev => {
      const currentLogs = prev[appId] || [];
      const line = `${time} ${type} ${entry.line}`;
      const updatedLogs = [...currentLogs, line];
      return { ...prev, [appId]: updatedLogs.length > MAX_LOG_ENTRIES ? updatedLogs.slice(-MAX_LOG_ENTRIES) : updatedLogs };
    });
  }, []);

  const addStructuredLogs = useCallback((appId: string, entries: LogEntry[]) => {
    if (!entries.length) return;
    if (!seenLinesRef.current[appId]) seenLinesRef.current[appId] = new Set();
    
    const newEntries: LogEntry[] = [];
    const newLines: string[] = [];
    
    for (const entry of entries) {
      const key = makeKey(entry);
      if (seenLinesRef.current[appId].has(key)) continue;
      seenLinesRef.current[appId].add(key);
      newEntries.push(entry);
      const type = entry.type === "stderr" ? "[ERR]" : "[OUT]";
      const time = new Date(entry.timestamp).toLocaleTimeString();
      newLines.push(`${time} ${type} ${entry.line}`);
    }

    if (!newEntries.length) return;

    // Cap the seen-set
    if (seenLinesRef.current[appId].size > MAX_LOG_ENTRIES * 2) {
      const arr = Array.from(seenLinesRef.current[appId]);
      seenLinesRef.current[appId] = new Set(arr.slice(-MAX_LOG_ENTRIES));
    }

    setLogEntries(prev => {
      const current = prev[appId] || [];
      const updated = [...current, ...newEntries];
      return { ...prev, [appId]: updated.length > MAX_LOG_ENTRIES ? updated.slice(-MAX_LOG_ENTRIES) : updated };
    });

    setLogs(prev => {
      const currentLogs = prev[appId] || [];
      const updatedLogs = [...currentLogs, ...newLines];
      return { ...prev, [appId]: updatedLogs.length > MAX_LOG_ENTRIES ? updatedLogs.slice(-MAX_LOG_ENTRIES) : updatedLogs };
    });
  }, []);

  const setCurrentSessionId = useCallback((appId: string, sessionId: string) => {
    setCurrentSessionIds(prev => ({ ...prev, [appId]: sessionId }));
  }, []);

  const clearLogs = useCallback((appId: string) => {
    setLogs(prev => ({ ...prev, [appId]: [] }));
    setLogEntries(prev => ({ ...prev, [appId]: [] }));
    if (seenLinesRef.current[appId]) {
      seenLinesRef.current[appId].clear();
    }
  }, []);

  return (
    <LogContext.Provider value={{
      logs, logEntries, currentSessionIds,
      addLog, addStructuredLog, addStructuredLogs,
      setCurrentSessionId, clearLogs
    }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogContext = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error("useLogContext must be used within a LogProvider");
  }
  return context;
};

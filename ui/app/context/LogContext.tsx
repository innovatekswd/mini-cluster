import React, { createContext, useCallback, useContext, useState } from "react";

interface LogContextType {
  logs: Record<string, string[]>;
  addLog: (appId: string, log: string) => void;
  clearLogs: (appId: string) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<Record<string, string[]>>({});

  const addLog = useCallback((appId: string, log: string) => {
    setLogs(prev => {
      const currentLogs = prev[appId] || [];
      // Keep last 200 log entries
      //const updatedLogs = [...currentLogs, log].slice(-200);
      const updatedLogs = [...currentLogs, log];
      return { ...prev, [appId]: updatedLogs };
    });
  },[]);

  const clearLogs =useCallback( (appId: string) => {
    setLogs(prev => ({ ...prev, [appId]: [] }));
  },[]);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogContext = (): LogContextType => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error("useLogContext must be used within a LogProvider");
  }
  return context;
};

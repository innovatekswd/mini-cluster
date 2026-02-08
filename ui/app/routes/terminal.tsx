import { useState, useCallback } from "react";
import { Terminal } from "../components/Terminal";
import { Layout } from "../components/Layout";

interface TerminalTab {
  id: string;
  name: string;
  workingDirectory?: string;
}

export default function TerminalPage() {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "1", name: "Terminal 1" }
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [nextTabId, setNextTabId] = useState(2);

  const addTab = useCallback(() => {
    const newTab: TerminalTab = {
      id: String(nextTabId),
      name: `Terminal ${nextTabId}`,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setNextTabId(prev => prev + 1);
  }, [nextTabId]);

  const closeTab = useCallback((tabId: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (newTabs.length === 0) {
        // Always keep at least one tab
        const newTab: TerminalTab = { id: String(nextTabId), name: `Terminal ${nextTabId}` };
        setNextTabId(n => n + 1);
        setActiveTabId(newTab.id);
        return [newTab];
      }
      
      // If closing active tab, switch to another
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex(t => t.id === tabId);
        const newActiveIndex = closedIndex > 0 ? closedIndex - 1 : 0;
        setActiveTabId(newTabs[newActiveIndex].id);
      }
      
      return newTabs;
    });
  }, [activeTabId, nextTabId]);

  const handleTerminalExit = useCallback((tabId: string, exitCode: number) => {
    // Terminal exited - could auto-close or show message
  }, []);

  return (
    <Layout>
      <div className="flex flex-col h-full bg-slate-900">
      {/* Tab bar */}
      <div className="flex items-center bg-slate-800 border-b border-slate-700 px-2">
        <div className="flex flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTabId === tab.id
                  ? "text-blue-400 border-blue-400 bg-slate-900/50"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {tab.name}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => closeTab(tab.id, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') closeTab(tab.id, e); }}
                className="ml-1 p-0.5 rounded hover:bg-slate-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </button>
          ))}
        </div>
        
        {/* New tab button */}
        <button
          onClick={addTab}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors ml-2"
          title="New Terminal"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Terminal area */}
      <div className="flex-1 relative">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTabId === tab.id ? "block" : "hidden"}`}
          >
            <Terminal
              workingDirectory={tab.workingDirectory}
              onExit={(exitCode) => handleTerminalExit(tab.id, exitCode)}
              className="h-full"
            />
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" />
            </svg>
            Connected
          </span>
          <span>{tabs.length} terminal{tabs.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl+Shift+T</kbd> for new tab</span>
        </div>
      </div>
      </div>
    </Layout>
  );
}

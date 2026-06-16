import React, { useState } from "react";

export type TabItemConfig = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  to?: string; // Optional: Relative path for NavLink (e.g., "logs", "files")
};

interface TabsProps {
  tabs: TabItemConfig[];
  onTabChange: (tabKey: string) => void;
  activeTab?: string; // Optional: explicitly set active tab from parent
}

export const Tabs: React.FC<TabsProps> = ({ tabs, onTabChange, activeTab: controlledActiveTab }) => {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.key || "");
  
  // Use controlled activeTab if provided, otherwise use internal state
  const activeTab = controlledActiveTab ?? internalActiveTab;
  
  const handleTabClick = (tabKey: string) => {
    setInternalActiveTab(tabKey);
    onTabChange(tabKey);
  };
  
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key)}
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm
            transition-all duration-200 ease-out
            ${activeTab === tab.key
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}
          `}
        >
          {tab.icon && <span className="opacity-80">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

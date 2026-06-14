import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useToast } from "~/components/Toast";
import { settingsService, type AppSettings, type IntervalOptions } from "~/services/settingsService";
import { 
  FaCog, FaSave, FaDatabase, FaChartLine, FaSearch, 
  FaHistory, FaClock, FaMemory, FaSync, FaUsers
} from "react-icons/fa";
import { UserManagement } from "./settings/UserManagement";
import { SystemPanel } from "./settings/SystemPanel";

type TabType = "general" | "users" | "system";

export default function SettingsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams.get("tab");
    return tab === "users" ? "users" : tab === "system" ? "system" : "general";
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [intervalOptions, setIntervalOptions] = useState<IntervalOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    maxMessagesToKeepInUi: 1000,
    enableLogSearch: true,
    metricsCollectionIntervalSeconds: 5,
    metricsRetentionHours: 24,
    metricsAggregationIntervalSeconds: 60,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "users") {
      setActiveTab("users");
    } else if (tab === "system") {
      setActiveTab("system");
    } else if (!tab || tab === "general") {
      setActiveTab("general");
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsData, intervals] = await Promise.all([
        settingsService.getSettings(),
        settingsService.getIntervalOptions(),
      ]);
      setSettings(settingsData);
      setIntervalOptions(intervals);
      setFormData({
        maxMessagesToKeepInUi: settingsData.maxMessagesToKeepInUi,
        enableLogSearch: settingsData.enableLogSearch,
        metricsCollectionIntervalSeconds: settingsData.metricsCollectionIntervalSeconds,
        metricsRetentionHours: settingsData.metricsRetentionHours,
        metricsAggregationIntervalSeconds: settingsData.metricsAggregationIntervalSeconds,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await settingsService.updateSettings(formData);
      setSettings(updated);
      setHasChanges(false);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        maxMessagesToKeepInUi: settings.maxMessagesToKeepInUi,
        enableLogSearch: settings.enableLogSearch,
        metricsCollectionIntervalSeconds: settings.metricsCollectionIntervalSeconds,
        metricsRetentionHours: settings.metricsRetentionHours,
        metricsAggregationIntervalSeconds: settings.metricsAggregationIntervalSeconds,
      });
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
          <div
            className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
    );
  }

  return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 
                flex items-center justify-center shadow-lg shadow-violet-500/20">
                <FaCog className="text-white text-xl" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
                <p className="text-sm text-slate-500">Configure application and metrics settings</p>
              </div>
            </div>
            
            {activeTab === "general" && (
              <>
                {hasChanges && (
                  <button
                    onClick={handleReset}
                    className="btn-secondary"
                    aria-label="Reset changes"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="btn-primary flex items-center gap-2"
                  aria-busy={saving}
                >
                  {saving ? (
                    <FaSync className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FaSave aria-hidden="true" />
                  )}
                  Save Changes
                </button>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-lg w-fit" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "general"}
              onClick={() => handleTabChange("general")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "general"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              <FaCog className="text-xs" aria-hidden="true" />
              General
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "users"}
              onClick={() => handleTabChange("users")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "users"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              <FaUsers className="text-xs" aria-hidden="true" />
              Users
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "system"}
              onClick={() => handleTabChange("system")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "system"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              <FaDatabase className="text-xs" aria-hidden="true" />
              System
            </button>
          </div>

          {activeTab === "general" && (
          <>
          {/* UI Settings */}
          <div className="card-elevated mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <FaChartLine className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">UI Settings</h2>
                <p className="text-sm text-slate-500">Configure user interface behavior</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Max Messages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Maximum Messages in Log Viewer
                  </label>
                  <p className="text-xs text-slate-500">
                    Number of log messages to keep in UI memory (100-10,000)
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={formData.maxMessagesToKeepInUi}
                    onChange={(e) => handleChange("maxMessagesToKeepInUi", parseInt(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    value={formData.maxMessagesToKeepInUi}
                    onChange={(e) => handleChange("maxMessagesToKeepInUi", parseInt(e.target.value) || 1000)}
                    className="input-field w-24 text-center"
                  />
                </div>
              </div>

              {/* Enable Log Search */}
              <div className="flex items-center justify-between py-3 border-t border-slate-700/50">
                <div className="flex items-center gap-3">
                  <FaSearch className="text-slate-400" />
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Enable Database Log Search
                    </label>
                    <p className="text-xs text-slate-500">
                      Allow searching historical logs in the database
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableLogSearch}
                    onChange={(e) => handleChange("enableLogSearch", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 
                    peer-focus:ring-cyan-500/50 rounded-full peer 
                    peer-checked:after:translate-x-full peer-checked:after:border-white 
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                    after:bg-white after:border-gray-300 after:border after:rounded-full 
                    after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Metrics Collection Settings */}
          <div className="card-elevated mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <FaMemory className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Process Metrics Collection</h2>
                <p className="text-sm text-slate-500">Configure how process metrics are collected</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Collection Interval */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    <FaClock className="inline mr-2 text-slate-400" />
                    Collection Interval
                  </label>
                  <p className="text-xs text-slate-500">
                    How often to collect process metrics (CPU, memory, etc.)
                  </p>
                </div>
                <select
                  value={formData.metricsCollectionIntervalSeconds}
                  onChange={(e) => handleChange("metricsCollectionIntervalSeconds", parseInt(e.target.value))}
                  className="input-field"
                >
                  {(intervalOptions?.collectionIntervals ?? intervalOptions?.intervals ?? []).map((opt) => (
                    <option key={opt.seconds} value={opt.seconds}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aggregation Interval */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-t border-slate-700/50 pt-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    <FaHistory className="inline mr-2 text-slate-400" />
                    Aggregation Interval
                  </label>
                  <p className="text-xs text-slate-500">
                    How to group metrics for historical averages
                  </p>
                </div>
                <select
                  value={formData.metricsAggregationIntervalSeconds}
                  onChange={(e) => handleChange("metricsAggregationIntervalSeconds", parseInt(e.target.value))}
                  className="input-field"
                >
                  {(intervalOptions?.aggregationIntervals ?? intervalOptions?.intervals ?? []).map((opt) => (
                    <option key={opt.seconds} value={opt.seconds}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Retention Hours */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-t border-slate-700/50 pt-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    <FaDatabase className="inline mr-2 text-slate-400" />
                    Data Retention
                  </label>
                  <p className="text-xs text-slate-500">
                    How long to keep raw metrics data (1-168 hours)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="168"
                    value={formData.metricsRetentionHours}
                    onChange={(e) => handleChange("metricsRetentionHours", parseInt(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <div className="text-slate-300 w-20 text-center">
                    {formData.metricsRetentionHours >= 24 
                      ? `${Math.floor(formData.metricsRetentionHours / 24)}d ${formData.metricsRetentionHours % 24}h`
                      : `${formData.metricsRetentionHours}h`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <FaChartLine className="text-amber-400 text-sm" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">About Metrics Collection</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Process metrics (CPU usage, memory, threads) are collected at the specified interval 
                  and stored in the database. Aggregated averages are computed at the aggregation interval 
                  and kept for 7 days. Raw metrics are automatically cleaned up after the retention period.
                  Timestamps are rounded to whole seconds for easier data analysis.
                </p>
              </div>
            </div>
          </div>

          {/* Last Modified */}
          {settings && (
            <div className="text-center mt-6 text-xs text-slate-500">
              Last modified: {new Date(settings.modifiedAt).toLocaleString()}
            </div>
          )}
          </>
          )}

          {activeTab === "users" && <UserManagement />}
          {activeTab === "system" && <SystemPanel />}
        </div>
      </div>
  );
}

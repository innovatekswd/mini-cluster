import apiClient from "~/lib/apiClient";

export interface AppSettings {
  id: number;
  maxMessagesToKeepInUi: number;
  enableLogSearch: boolean;
  metricsCollectionIntervalSeconds: number;
  metricsRetentionHours: number;
  metricsAggregationIntervalSeconds: number;
  modifiedAt: string;
}

export interface IntervalOption {
  seconds: number;
  label: string;
}

export interface IntervalOptions {
  collectionIntervals: IntervalOption[];
  aggregationIntervals: IntervalOption[];
}

export interface AppSettingsUpdate {
  maxMessagesToKeepInUi?: number;
  enableLogSearch?: boolean;
  metricsCollectionIntervalSeconds?: number;
  metricsRetentionHours?: number;
  metricsAggregationIntervalSeconds?: number;
}

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const res = await apiClient.get("/api/settings");
    return res.data;
  },

  async updateSettings(settings: AppSettingsUpdate): Promise<AppSettings> {
    const res = await apiClient.put("/api/settings", settings);
    return res.data;
  },

  async getIntervalOptions(): Promise<IntervalOptions> {
    const res = await apiClient.get("/api/settings/intervals");
    return res.data;
  },
};

import React from "react";
import { FaChartBar, FaCalendar, FaDownload, FaSave } from "react-icons/fa";

export default function ObserveAnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <FaChartBar className="text-cyan-400" />
            Analytics
          </h1>
          <p className="text-slate-400 mt-1">Historical data exploration and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <FaCalendar />
            Last 24h
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <FaDownload />
            Export
          </button>
          <button className="btn-primary flex items-center gap-2">
            <FaSave />
            Save Query
          </button>
        </div>
      </div>

      {/* Metrics Explorer */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Metrics Explorer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <label className="text-xs text-slate-400 mb-2 block">Metric</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option>CPU Usage</option>
              <option>Memory Usage</option>
              <option>Disk Usage</option>
              <option>Network I/O</option>
            </select>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <label className="text-xs text-slate-400 mb-2 block">Time Range</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option>Last 1 hour</option>
              <option>Last 6 hours</option>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <label className="text-xs text-slate-400 mb-2 block">Aggregation</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option>Average</option>
              <option>Maximum</option>
              <option>Minimum</option>
              <option>Sum</option>
            </select>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <label className="text-xs text-slate-400 mb-2 block">Chart Type</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option>Line Chart</option>
              <option>Area Chart</option>
              <option>Bar Chart</option>
              <option>Stacked Area</option>
            </select>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center">
            <FaChartBar className="text-4xl text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Chart will appear here</p>
            <p className="text-xs text-slate-500 mt-1">Select metrics and time range to view historical data</p>
          </div>
        </div>
      </div>

      {/* Saved Queries */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Saved Queries</h2>
        <div className="text-center py-8">
          <p className="text-slate-400">No saved queries yet</p>
          <p className="text-xs text-slate-500 mt-1">Save your frequently used queries for quick access</p>
        </div>
      </div>
    </div>
  );
}

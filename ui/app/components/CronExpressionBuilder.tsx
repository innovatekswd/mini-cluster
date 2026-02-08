import React, { useState, useEffect, useMemo } from "react";
import { FaClock, FaCode, FaMagic } from "react-icons/fa";

// ── Types ───────────────────────────────────────────────────

type ScheduleMode = "preset" | "custom";

type PresetCategory =
  | "every-minute"
  | "every-hour"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "interval";

interface PresetConfig {
  category: PresetCategory;
  // For daily/weekly/monthly/yearly
  hour: number;
  minute: number;
  // For weekly
  weekday: number; // 0=Sun 1=Mon ... 6=Sat
  // For monthly
  dayOfMonth: number;
  // For yearly
  month: number;
  // For interval
  intervalValue: number;
  intervalUnit: "minutes" | "hours";
}

interface CronExpressionBuilderProps {
  value: string;
  onChange: (expression: string) => void;
}

// ── Constants ───────────────────────────────────────────────

const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const MONTHS = [
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
];

const PRESET_CATEGORIES: { value: PresetCategory; label: string; icon: string; description: string }[] = [
  { value: "every-minute", label: "Every Minute", icon: "⚡", description: "Runs every minute" },
  { value: "interval", label: "Every N Minutes/Hours", icon: "🔄", description: "Custom interval" },
  { value: "every-hour", label: "Every Hour", icon: "🕐", description: "Once per hour at a specific minute" },
  { value: "daily", label: "Daily", icon: "📅", description: "Once a day at a specific time" },
  { value: "weekly", label: "Weekly", icon: "📆", description: "Once a week on a specific day & time" },
  { value: "monthly", label: "Monthly", icon: "🗓️", description: "Once a month on a specific day & time" },
  { value: "yearly", label: "Yearly", icon: "🎯", description: "Once a year on a specific date & time" },
];

// ── Helpers ─────────────────────────────────────────────────

function buildExpression(config: PresetConfig): string {
  const { category, hour, minute, weekday, dayOfMonth, month, intervalValue, intervalUnit } = config;
  // 6-field: second minute hour dayOfMonth month dayOfWeek
  switch (category) {
    case "every-minute":
      return "0 * * * * *";
    case "interval":
      if (intervalUnit === "minutes") {
        return `0 */${intervalValue} * * * *`;
      }
      return `0 0 */${intervalValue} * * *`;
    case "every-hour":
      return `0 ${minute} * * * *`;
    case "daily":
      return `0 ${minute} ${hour} * * *`;
    case "weekly":
      return `0 ${minute} ${hour} * * ${weekday}`;
    case "monthly":
      return `0 ${minute} ${hour} ${dayOfMonth} * *`;
    case "yearly":
      return `0 ${minute} ${hour} ${dayOfMonth} ${month} *`;
    default:
      return "0 * * * * *";
  }
}

function describeExpression(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 6) return expr;
  const [sec, min, hr, dom, mon, dow] = parts;

  // Every minute
  if (sec === "0" && min === "*" && hr === "*" && dom === "*" && mon === "*" && dow === "*")
    return "Every minute";

  // Every N minutes
  if (sec === "0" && min.startsWith("*/") && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = min.slice(2);
    return `Every ${n} minute${n === "1" ? "" : "s"}`;
  }

  // Every N hours
  if (sec === "0" && min === "0" && hr.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    const n = hr.slice(2);
    return `Every ${n} hour${n === "1" ? "" : "s"}`;
  }

  // Every hour at :MM
  if (sec === "0" && !min.includes("*") && !min.includes("/") && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every hour at :${min.padStart(2, "0")}`;
  }

  // Daily at HH:MM
  if (sec === "0" && !min.includes("*") && !hr.includes("*") && dom === "*" && mon === "*" && dow === "*") {
    return `Daily at ${formatTime(Number(hr), Number(min))}`;
  }

  // Weekly
  if (sec === "0" && !min.includes("*") && !hr.includes("*") && dom === "*" && mon === "*" && !dow.includes("*")) {
    const day = WEEKDAYS[Number(dow)]?.label ?? dow;
    return `Every ${day} at ${formatTime(Number(hr), Number(min))}`;
  }

  // Monthly
  if (sec === "0" && !min.includes("*") && !hr.includes("*") && !dom.includes("*") && mon === "*" && dow === "*") {
    return `Monthly on the ${ordinal(Number(dom))} at ${formatTime(Number(hr), Number(min))}`;
  }

  // Yearly
  if (sec === "0" && !min.includes("*") && !hr.includes("*") && !dom.includes("*") && !mon.includes("*") && dow === "*") {
    const monthName = MONTHS[Number(mon) - 1]?.short ?? mon;
    return `Yearly on ${monthName} ${ordinal(Number(dom))} at ${formatTime(Number(hr), Number(min))}`;
  }

  return expr;
}

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function tryParsePreset(expr: string): PresetConfig | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 6 || parts[0] !== "0") return null;
  const [, min, hr, dom, mon, dow] = parts;

  // Every minute
  if (min === "*" && hr === "*" && dom === "*" && mon === "*" && dow === "*")
    return { category: "every-minute", hour: 0, minute: 0, weekday: 1, dayOfMonth: 1, month: 1, intervalValue: 5, intervalUnit: "minutes" };

  // Every N minutes
  if (min.startsWith("*/") && hr === "*" && dom === "*" && mon === "*" && dow === "*")
    return { category: "interval", hour: 0, minute: 0, weekday: 1, dayOfMonth: 1, month: 1, intervalValue: Number(min.slice(2)), intervalUnit: "minutes" };

  // Every N hours
  if (min === "0" && hr.startsWith("*/") && dom === "*" && mon === "*" && dow === "*")
    return { category: "interval", hour: 0, minute: 0, weekday: 1, dayOfMonth: 1, month: 1, intervalValue: Number(hr.slice(2)), intervalUnit: "hours" };

  // Hourly at :MM
  if (/^\d+$/.test(min) && hr === "*" && dom === "*" && mon === "*" && dow === "*")
    return { category: "every-hour", hour: 0, minute: Number(min), weekday: 1, dayOfMonth: 1, month: 1, intervalValue: 5, intervalUnit: "minutes" };

  // Daily
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === "*" && mon === "*" && dow === "*")
    return { category: "daily", hour: Number(hr), minute: Number(min), weekday: 1, dayOfMonth: 1, month: 1, intervalValue: 5, intervalUnit: "minutes" };

  // Weekly
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === "*" && mon === "*" && /^\d+$/.test(dow))
    return { category: "weekly", hour: Number(hr), minute: Number(min), weekday: Number(dow), dayOfMonth: 1, month: 1, intervalValue: 5, intervalUnit: "minutes" };

  // Monthly
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dom) && mon === "*" && dow === "*")
    return { category: "monthly", hour: Number(hr), minute: Number(min), weekday: 1, dayOfMonth: Number(dom), month: 1, intervalValue: 5, intervalUnit: "minutes" };

  // Yearly
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dom) && /^\d+$/.test(mon) && dow === "*")
    return { category: "yearly", hour: Number(hr), minute: Number(min), weekday: 1, dayOfMonth: Number(dom), month: Number(mon), intervalValue: 5, intervalUnit: "minutes" };

  return null;
}

// ── Component ───────────────────────────────────────────────

export function CronExpressionBuilder({ value, onChange }: CronExpressionBuilderProps) {
  const parsedPreset = useMemo(() => tryParsePreset(value), [value]);
  const [mode, setMode] = useState<ScheduleMode>(parsedPreset ? "preset" : "custom");
  const [config, setConfig] = useState<PresetConfig>(
    parsedPreset ?? {
      category: "daily",
      hour: 0,
      minute: 0,
      weekday: 1,
      dayOfMonth: 1,
      month: 1,
      intervalValue: 5,
      intervalUnit: "minutes",
    }
  );
  const [customExpr, setCustomExpr] = useState(value);

  // Rebuild expression when config changes in preset mode
  useEffect(() => {
    if (mode === "preset") {
      const expr = buildExpression(config);
      onChange(expr);
    }
  }, [config, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfig = <K extends keyof PresetConfig>(key: K, val: PresetConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const humanDescription = useMemo(() => describeExpression(value), [value]);

  return (
    <div className="space-y-3">
      {/* Mode Tabs */}
      <div className="flex gap-1 p-0.5 bg-slate-800 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => {
            setMode("preset");
            // Re-apply preset expression
            const expr = buildExpression(config);
            onChange(expr);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "preset"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FaMagic className="text-xs" />
          Easy
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("custom");
            setCustomExpr(value);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "custom"
              ? "bg-cyan-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FaCode className="text-xs" />
          Advanced
        </button>
      </div>

      {mode === "preset" ? (
        <div className="space-y-3">
          {/* Category Selector */}
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => updateConfig("category", cat.value)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                  config.category === cat.value
                    ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300 shadow-sm"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                }`}
                title={cat.description}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="w-full text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Category-specific controls */}
          <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
            {config.category === "every-minute" && (
              <p className="text-sm text-slate-400 text-center py-1">
                Runs at the start of every minute. No additional configuration needed.
              </p>
            )}

            {config.category === "interval" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">Every</span>
                <input
                  type="number"
                  min={1}
                  max={config.intervalUnit === "minutes" ? 59 : 23}
                  value={config.intervalValue}
                  onChange={(e) => updateConfig("intervalValue", Math.max(1, Number(e.target.value)))}
                  className="input-dark w-20 text-center"
                  title="Interval value"
                />
                <select
                  className="input-dark"
                  value={config.intervalUnit}
                  title="Interval unit"
                  onChange={(e) => updateConfig("intervalUnit", e.target.value as "minutes" | "hours")}
                >
                  <option value="minutes">Minute(s)</option>
                  <option value="hours">Hour(s)</option>
                </select>
              </div>
            )}

            {config.category === "every-hour" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">At minute</span>
                <select
                  className="input-dark w-20"
                  value={config.minute}
                  title="Minute"
                  onChange={(e) => updateConfig("minute", Number(e.target.value))}
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={i}>:{String(i).padStart(2, "0")}</option>
                  ))}
                </select>
                <span className="text-sm text-slate-500">of every hour</span>
              </div>
            )}

            {config.category === "daily" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">At</span>
                <TimeSelector
                  hour={config.hour}
                  minute={config.minute}
                  onHourChange={(h) => updateConfig("hour", h)}
                  onMinuteChange={(m) => updateConfig("minute", m)}
                />
                <span className="text-sm text-slate-500">every day</span>
              </div>
            )}

            {config.category === "weekly" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => updateConfig("weekday", d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        config.weekday === d.value
                          ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300"
                          : "bg-slate-700/40 border-slate-600/30 text-slate-400 hover:bg-slate-700/60"
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">At</span>
                  <TimeSelector
                    hour={config.hour}
                    minute={config.minute}
                    onHourChange={(h) => updateConfig("hour", h)}
                    onMinuteChange={(m) => updateConfig("minute", m)}
                  />
                </div>
              </div>
            )}

            {config.category === "monthly" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">On day</span>
                  <select
                    className="input-dark w-20"
                    value={config.dayOfMonth}
                    title="Day of month"
                    onChange={(e) => updateConfig("dayOfMonth", Number(e.target.value))}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-500">of every month</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">At</span>
                  <TimeSelector
                    hour={config.hour}
                    minute={config.minute}
                    onHourChange={(h) => updateConfig("hour", h)}
                    onMinuteChange={(m) => updateConfig("minute", m)}
                  />
                </div>
              </div>
            )}

            {config.category === "yearly" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-slate-300">On</span>
                  <select
                    className="input-dark"
                    value={config.month}
                    title="Month"
                    onChange={(e) => updateConfig("month", Number(e.target.value))}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    className="input-dark w-20"
                    value={config.dayOfMonth}
                    title="Day of month"
                    onChange={(e) => updateConfig("dayOfMonth", Number(e.target.value))}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">At</span>
                  <TimeSelector
                    hour={config.hour}
                    minute={config.minute}
                    onHourChange={(h) => updateConfig("hour", h)}
                    onMinuteChange={(m) => updateConfig("minute", m)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Custom / Advanced mode */
        <div className="space-y-2">
          <input
            className="input-dark w-full font-mono"
            value={customExpr}
            onChange={(e) => {
              setCustomExpr(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="0 */5 * * * *"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-500">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-slate-400">Field</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-400">Allowed</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-400">Special</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr><td className="px-2 py-0.5">Second</td><td className="px-2 py-0.5 font-mono">0-59</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
                <tr><td className="px-2 py-0.5">Minute</td><td className="px-2 py-0.5 font-mono">0-59</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
                <tr><td className="px-2 py-0.5">Hour</td><td className="px-2 py-0.5 font-mono">0-23</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
                <tr><td className="px-2 py-0.5">Day of Month</td><td className="px-2 py-0.5 font-mono">1-31</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
                <tr><td className="px-2 py-0.5">Month</td><td className="px-2 py-0.5 font-mono">1-12</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
                <tr><td className="px-2 py-0.5">Day of Week</td><td className="px-2 py-0.5 font-mono">0-6</td><td className="px-2 py-0.5 font-mono">* , - /</td></tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <QuickPreset label="Every 5 min" expr="0 */5 * * * *" onClick={applyQuickPreset} />
            <QuickPreset label="Every 15 min" expr="0 */15 * * * *" onClick={applyQuickPreset} />
            <QuickPreset label="Hourly" expr="0 0 * * * *" onClick={applyQuickPreset} />
            <QuickPreset label="Daily midnight" expr="0 0 0 * * *" onClick={applyQuickPreset} />
            <QuickPreset label="Daily 3 AM" expr="0 0 3 * * *" onClick={applyQuickPreset} />
            <QuickPreset label="Mon-Fri 9 AM" expr="0 0 9 * * 1-5" onClick={applyQuickPreset} />
            <QuickPreset label="Weekly Sun" expr="0 0 0 * * 0" onClick={applyQuickPreset} />
            <QuickPreset label="Monthly 1st" expr="0 0 0 1 * *" onClick={applyQuickPreset} />
          </div>
        </div>
      )}

      {/* Human-readable preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30">
        <FaClock className="text-cyan-500 flex-shrink-0 text-sm" />
        <span className="text-sm text-slate-300">{humanDescription}</span>
        <code className="ml-auto text-xs font-mono text-slate-500 flex-shrink-0">{value}</code>
      </div>
    </div>
  );

  function applyQuickPreset(expr: string) {
    setCustomExpr(expr);
    onChange(expr);
  }
}

// ── Sub-components ──────────────────────────────────────────

function TimeSelector({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  const isPM = hour >= 12;
  const displayHour = hour % 12 || 12;

  return (
    <div className="flex items-center gap-1">
      <select
        className="input-dark w-16 text-center"
        value={displayHour}
        title="Hour"
        onChange={(e) => {
          const h = Number(e.target.value);
          onHourChange(isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h));
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <span className="text-slate-500 font-bold">:</span>
      <select
        className="input-dark w-16 text-center"
        value={minute}
        title="Minute"
        onChange={(e) => onMinuteChange(Number(e.target.value))}
      >
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
        ))}
      </select>
      <select
        className="input-dark w-16 text-center"
        value={isPM ? "PM" : "AM"}
        title="AM/PM"
        onChange={(e) => {
          const newPM = e.target.value === "PM";
          if (newPM && !isPM) onHourChange(hour + 12);
          else if (!newPM && isPM) onHourChange(hour - 12);
        }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

function QuickPreset({ label, expr, onClick }: { label: string; expr: string; onClick: (expr: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(expr)}
      className="px-2 py-1 rounded text-xs font-mono bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-slate-200 border border-slate-600/30 transition-colors"
      title={expr}
    >
      {label}
    </button>
  );
}

// Export the description helper for use elsewhere
export { describeExpression };

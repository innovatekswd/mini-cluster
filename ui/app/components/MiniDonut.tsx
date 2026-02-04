import React from "react";

interface MiniDonutProps {
  value: number; // 0-100 percentage
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  showValue?: boolean;
  icon?: React.ReactNode;
  label?: string;
}

export function MiniDonut({
  value,
  size = 32,
  strokeWidth = 3,
  color = "#60a5fa",
  bgColor = "#1e293b",
  showValue = true,
  icon,
  label,
}: MiniDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center gap-1.5" title={label ? `${label}: ${progress.toFixed(1)}%` : `${progress.toFixed(1)}%`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        {/* Center icon or value */}
        <div className="absolute inset-0 flex items-center justify-center">
          {icon ? (
            <span style={{ color }} className="text-[8px]">{icon}</span>
          ) : showValue ? (
            <span className="text-[8px] font-bold" style={{ color }}>
              {Math.round(progress)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface SystemMetricDonutProps {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  suffix?: string;
  maxValue?: number;
}

export function SystemMetricDonut({
  label,
  value,
  color,
  icon,
  suffix = "%",
  maxValue = 100,
}: SystemMetricDonutProps) {
  const percentage = (value / maxValue) * 100;
  
  return (
    <div 
      className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-800/40 hover:bg-slate-800/60 transition-colors cursor-default"
      title={`${label}: ${value.toFixed(1)}${suffix}`}
    >
      <MiniDonut value={percentage} size={24} strokeWidth={2.5} color={color} icon={icon} />
      <span className="text-[10px] font-medium tabular-nums" style={{ color }}>
        {Math.round(value)}{suffix === "%" ? "" : ""}
      </span>
    </div>
  );
}

import React from "react";

type ChartColor = 'blue' | 'green' | 'violet' | 'cyan' | 'amber';

interface RichChartProps {
  data: number[];
  timestamps?: string[];
  color: ChartColor;
  height: number;
  maxValue?: number;
  showTimeAxis?: boolean;
  showValueAxis?: boolean;
  showGrid?: boolean;
  label?: string;
  unit?: string;
}

const colorMap: Record<ChartColor, { stroke: string; fill: string }> = {
  blue: { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.1)' },
  green: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.1)' },
  violet: { stroke: '#a78bfa', fill: 'rgba(167, 139, 250, 0.1)' },
  cyan: { stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.1)' },
  amber: { stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.1)' },
};

function formatTimeLabel(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function formatValue(value: number, unit?: string): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M${unit || ''}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K${unit || ''}`;
  return `${value.toFixed(1)}${unit || ''}`;
}

export function RichChart({
  data,
  timestamps,
  color,
  height,
  maxValue,
  showTimeAxis = false,
  showValueAxis = false,
  showGrid = false,
  label,
  unit,
}: RichChartProps) {
  if (data.length === 0) return null;

  const max = maxValue || Math.max(...data) * 1.1 || 1;
  const min = Math.min(...data);

  // Chart dimensions
  const padding = { top: 10, right: 10, bottom: showTimeAxis ? 25 : 5, left: showValueAxis ? 50 : 5 };
  const width = 400;
  const chartHeight = height;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Generate points
  const points = data.map((value, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - (value / max) * innerHeight;
    return { x, y, value };
  });

  const pathPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const fillPoints = `${padding.left},${padding.top + innerHeight} ${pathPoints} ${padding.left + innerWidth},${padding.top + innerHeight}`;

  const colors = colorMap[color];

  // Generate value axis labels (5 evenly spaced)
  const valueLabels = showValueAxis
    ? Array.from({ length: 5 }, (_, i) => {
        const value = min + ((max - min) * i) / 4;
        const y = padding.top + innerHeight - (value / max) * innerHeight;
        return { value, y, label: formatValue(value, unit) };
      })
    : [];

  // Generate time axis labels (6 evenly spaced)
  const timeLabels = showTimeAxis && timestamps && timestamps.length > 1
    ? Array.from({ length: 6 }, (_, i) => {
        const index = Math.floor((timestamps.length - 1) * (i / 5));
        const x = padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
        return { x, label: formatTimeLabel(timestamps[index]) };
      })
    : [];

  // Generate grid lines
  const gridLines = showGrid
    ? valueLabels.map((vl, i) => ({
        y: vl.y,
        key: i,
      }))
    : [];

  const ariaLabel = label
    ? `${label} chart showing ${data.length} data points`
    : `Chart showing ${data.length} data points`;

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full"
      style={{ height: chartHeight }}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map((gl) => (
        <line
          key={gl.key}
          x1={padding.left}
          y1={gl.y}
          x2={padding.left + innerWidth}
          y2={gl.y}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      ))}

      {/* Fill area */}
      <polygon
        points={fillPoints}
        fill={`url(#gradient-${color})`}
      />

      {/* Line */}
      <polyline
        points={pathPoints}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Value axis labels */}
      {showValueAxis && valueLabels.map((vl, i) => (
        <text
          key={i}
          x={padding.left - 5}
          y={vl.y + 3}
          textAnchor="end"
          fontSize="9"
          fill="rgba(148, 163, 184, 0.7)"
        >
          {vl.label}
        </text>
      ))}

      {/* Time axis labels */}
      {showTimeAxis && timeLabels.map((tl, i) => (
        <text
          key={i}
          x={tl.x}
          y={padding.top + innerHeight + 15}
          textAnchor="middle"
          fontSize="8"
          fill="rgba(148, 163, 184, 0.7)"
        >
          {tl.label}
        </text>
      ))}
    </svg>
  );
}

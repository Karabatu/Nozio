import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { DailyLog } from '../types';
import { BarChart3, TrendingUp, CalendarDays, CalendarRange } from 'lucide-react';

interface CalorieTrendChartProps {
  currentDateStr: string;
  allLogs: DailyLog[];
  targetKcal: number;
}

type ViewType = 'last7' | 'week' | 'month' | 'year';

interface ChartDataItem {
  label: string;
  fullLabel: string;
  value: number;
  hasData: boolean;
  dateStr?: string;
}

export default function CalorieTrendChart({
  currentDateStr,
  allLogs,
  targetKcal
}: CalorieTrendChartProps) {
  const [viewType, setViewType] = useState<ViewType>('last7');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Map of date string to log for quick lookup
  const logsMap = useMemo(() => {
    const map = new Map<string, DailyLog>();
    allLogs.forEach(log => {
      map.set(log.date, log);
    });
    return map;
  }, [allLogs]);

  // Helper: Format Date to YYYY-MM-DD
  const formatDateToKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Helper: Calculate daily consumed calories for a date
  const getConsumedKcalForDate = (dateStr: string): { kcal: number; hasData: boolean } => {
    const log = logsMap.get(dateStr);
    if (!log) return { kcal: 0, hasData: false };
    const total = log.meals.reduce((sum, meal) => sum + (meal.kcal || 0), 0);
    return { kcal: total, hasData: log.meals.length > 0 };
  };

  // Generate data based on viewType
  const chartData = useMemo<ChartDataItem[]>(() => {
    const [year, month, day] = currentDateStr.split('-').map(Number);
    const activeDate = new Date(year, month - 1, day);

    switch (viewType) {
      case 'last7': {
        // Last 7 days ending today/active date
        const data: ChartDataItem[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(activeDate);
          d.setDate(activeDate.getDate() - i);
          const key = formatDateToKey(d);
          const { kcal, hasData } = getConsumedKcalForDate(key);
          const weekdayLabel = d.toLocaleDateString('de-DE', { weekday: 'short' });
          const dayNum = d.getDate();
          
          data.push({
            label: `${weekdayLabel} ${dayNum}.`,
            fullLabel: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
            value: kcal,
            hasData,
            dateStr: key
          });
        }
        return data;
      }

      case 'week': {
        // Current week Monday - Sunday containing activeDate
        const dayOfWeek = activeDate.getDay(); // 0 = Sunday, 1 = Monday...
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(activeDate);
        monday.setDate(activeDate.getDate() + diffToMonday);

        const data: ChartDataItem[] = [];
        const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const key = formatDateToKey(d);
          const { kcal, hasData } = getConsumedKcalForDate(key);
          
          data.push({
            label: weekdays[i],
            fullLabel: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
            value: kcal,
            hasData,
            dateStr: key
          });
        }
        return data;
      }

      case 'month': {
        // All days of the current month containing activeDate
        const numDays = new Date(year, month, 0).getDate();
        const data: ChartDataItem[] = [];

        for (let i = 1; i <= numDays; i++) {
          const d = new Date(year, month - 1, i);
          const key = formatDateToKey(d);
          const { kcal, hasData } = getConsumedKcalForDate(key);
          
          // Only show label for every 5th day to avoid overlap, but full label in tooltip
          const label = i === 1 || i % 5 === 0 || i === numDays ? `${i}.` : '';
          
          data.push({
            label,
            fullLabel: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }),
            value: kcal,
            hasData,
            dateStr: key
          });
        }
        return data;
      }

      case 'year': {
        // 12 months of the current year
        const data: ChartDataItem[] = [];
        const monthNames = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        const fullMonthNames = [
          'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
          'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];

        for (let m = 0; m < 12; m++) {
          // Find all logs for this month in the current year
          let totalKcalForMonth = 0;
          let loggedDaysCount = 0;

          allLogs.forEach(log => {
            const [logY, logM, _] = log.date.split('-').map(Number);
            if (logY === year && logM === m + 1) {
              const dayKcal = log.meals.reduce((sum, meal) => sum + (meal.kcal || 0), 0);
              totalKcalForMonth += dayKcal;
              loggedDaysCount++;
            }
          });

          // Calculate average calories for logged days in this month
          const avgKcal = loggedDaysCount > 0 ? Math.round(totalKcalForMonth / loggedDaysCount) : 0;

          data.push({
            label: monthNames[m],
            fullLabel: `${fullMonthNames[m]} ${year} (Schnitt von ${loggedDaysCount} getrackten Tagen)`,
            value: avgKcal,
            hasData: loggedDaysCount > 0
          });
        }
        return data;
      }
    }
  }, [viewType, currentDateStr, allLogs, logsMap]);

  // Statistics for display
  const statsSummary = useMemo(() => {
    // Filter out items that have data or calculate based on selection
    const itemsWithData = chartData.filter(d => d.hasData);
    const avg = itemsWithData.length > 0 
      ? Math.round(itemsWithData.reduce((sum, d) => sum + d.value, 0) / itemsWithData.length)
      : 0;
    
    const maxVal = d3.max(chartData, (d: ChartDataItem) => d.value) || 0;

    let viewTitle = '';
    if (viewType === 'last7') viewTitle = 'Letzte 7 Tage';
    else if (viewType === 'week') viewTitle = 'Diese Woche (Mo - So)';
    else if (viewType === 'month') {
      const [_, m] = currentDateStr.split('-').map(Number);
      const monthLabel = new Date(2000, m - 1, 1).toLocaleDateString('de-DE', { month: 'long' });
      viewTitle = `Monat (${monthLabel})`;
    } else if (viewType === 'year') {
      const [y] = currentDateStr.split('-').map(Number);
      viewTitle = `Jahr ${y}`;
    }

    return {
      average: avg,
      max: maxVal,
      viewTitle,
      trackedDays: itemsWithData.length
    };
  }, [chartData, viewType, currentDateStr]);

  // SVG dimensions
  const width = 460;
  const height = 180;
  const padding = { top: 15, right: 15, bottom: 30, left: 45 };

  // D3 Scales calculation
  const xScale = useMemo(() => {
    return d3.scaleBand()
      .domain(chartData.map(d => d.label))
      .range([padding.left, width - padding.right])
      .padding(viewType === 'month' ? 0.1 : 0.3);
  }, [chartData, viewType, width, padding.left, padding.right]);

  const yScale = useMemo(() => {
    const maxValue = d3.max(chartData, (d: ChartDataItem) => d.value) || 0;
    const yMax = Math.max(targetKcal * 1.15, maxValue, 1000);
    return d3.scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([height - padding.bottom, padding.top]);
  }, [chartData, targetKcal, height, padding.top, padding.bottom]);

  // Grid ticks
  const yTicks = useMemo(() => {
    return yScale.ticks(4);
  }, [yScale]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl shadow-xl space-y-4">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-950/40 rounded-xl border border-emerald-900/40">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trendanalyse</h3>
            <p className="text-[10px] text-zinc-500 font-medium">Kalorien- & Energieverlauf</p>
          </div>
        </div>

        {/* View Type Selectors */}
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-850 self-start sm:self-auto">
          <button
            onClick={() => setViewType('last7')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              viewType === 'last7' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            7 Tage
          </button>
          <button
            onClick={() => setViewType('week')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              viewType === 'week' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Woche
          </button>
          <button
            onClick={() => setViewType('month')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              viewType === 'month' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Monat
          </button>
          <button
            onClick={() => setViewType('year')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              viewType === 'year' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Jahr
          </button>
        </div>
      </div>

      {/* Summary KPI section */}
      <div className="grid grid-cols-2 gap-4 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-850/40">
        <div className="space-y-0.5">
          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
            {viewType === 'year' ? 'Ø Monatlicher Schnitt' : 'Ø Täglicher Schnitt'}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-400 font-sans">
              {statsSummary.average.toLocaleString('de-DE')}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold">kcal</span>
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Zeitraum</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-zinc-200 block truncate">{statsSummary.viewTitle}</span>
            <span className="text-[9px] text-zinc-500 font-medium">
              ({statsSummary.trackedDays} {statsSummary.trackedDays === 1 ? 'Tag' : 'Tage'})
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="barHoverGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="emptyBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#27272a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#18181b" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {yTicks.map((tick, i) => (
            <g key={i} className="opacity-20">
              <line
                x1={padding.left}
                y1={yScale(tick)}
                x2={width - padding.right}
                y2={yScale(tick)}
                stroke="#52525b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={yScale(tick) + 3}
                fill="#a1a1aa"
                fontSize={9}
                fontWeight="medium"
                textAnchor="end"
                className="font-mono"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Target Kcal Reference Line (Horizontal) */}
          {viewType !== 'year' && (
            <g>
              <line
                x1={padding.left}
                y1={yScale(targetKcal)}
                x2={width - padding.right}
                y2={yScale(targetKcal)}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                className="opacity-75"
              />
              <text
                x={width - padding.right}
                y={yScale(targetKcal) - 5}
                fill="#f59e0b"
                fontSize={8}
                fontWeight="bold"
                textAnchor="end"
              >
                Ziel: {targetKcal} kcal
              </text>
            </g>
          )}

          {/* Bars */}
          {chartData.map((d, i) => {
            const barX = xScale(d.label);
            const barWidth = xScale.bandwidth();
            if (barX === undefined) return null;

            // Height and placement logic
            const barHeight = height - padding.bottom - yScale(d.value);
            const yPos = yScale(d.value);
            const isEmpty = d.value === 0;

            // Give a very tiny visual indicator if empty bar, or full bar
            const computedHeight = isEmpty ? 3 : barHeight;
            const computedY = isEmpty ? height - padding.bottom - 3 : yPos;

            const isHovered = hoveredIndex === i;

            return (
              <g 
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer transition-all duration-150"
              >
                {/* Visual Bar */}
                <rect
                  x={barX}
                  y={computedY}
                  width={barWidth}
                  height={computedHeight}
                  rx={Math.max(1.5, barWidth / 5)}
                  fill={
                    isEmpty 
                      ? 'url(#emptyBarGradient)' 
                      : (isHovered ? 'url(#barHoverGradient)' : 'url(#barGradient)')
                  }
                  stroke={isEmpty ? '#3f3f46' : (isHovered ? '#34d399' : '#10b981')}
                  strokeWidth={isEmpty ? 0.5 : (isHovered ? 1.5 : 0.5)}
                  className="transition-all duration-200"
                />

                {/* Invisible Hover Catcher Area for easy touching/mouse interaction */}
                <rect
                  x={barX - 2}
                  y={padding.top}
                  width={barWidth + 4}
                  height={height - padding.top - padding.bottom}
                  fill="transparent"
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {chartData.map((d, i) => {
            const barX = xScale(d.label);
            if (barX === undefined || !d.label) return null;
            const xPos = barX + xScale.bandwidth() / 2;

            return (
              <text
                key={i}
                x={xPos}
                y={height - padding.bottom + 16}
                fill={hoveredIndex === i ? '#34d399' : '#71717a'}
                fontSize={viewType === 'month' ? 8 : 9}
                fontWeight={hoveredIndex === i ? 'bold' : 'semibold'}
                textAnchor="middle"
                className="transition-colors duration-150 font-sans"
              >
                {d.label}
              </text>
            );
          })}

          {/* Bottom Border Line */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#27272a"
            strokeWidth={1}
          />
        </svg>

        {/* Floating Tooltip Container */}
        <div className="absolute top-2 right-2 pointer-events-none transition-all duration-200">
          {hoveredIndex !== null && chartData[hoveredIndex] ? (
            <div className="bg-zinc-950/95 border border-zinc-800 p-2.5 rounded-xl shadow-lg text-left max-w-xs backdrop-blur-sm animate-fade-in">
              <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">
                {chartData[hoveredIndex].fullLabel}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-emerald-400">
                  {chartData[hoveredIndex].value.toLocaleString('de-DE')} kcal
                </span>
                {chartData[hoveredIndex].value > 0 && viewType !== 'year' && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    chartData[hoveredIndex].value > targetKcal 
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-900/40' 
                      : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'
                  }`}>
                    {chartData[hoveredIndex].value > targetKcal 
                      ? `+${Math.round(chartData[hoveredIndex].value - targetKcal)} kcal` 
                      : `-${Math.round(targetKcal - chartData[hoveredIndex].value)} kcal`
                    }
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium bg-zinc-950/30 px-2 py-1 rounded-lg border border-zinc-850/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Fahre über die Balken für Details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

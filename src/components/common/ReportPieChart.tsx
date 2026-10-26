import React, { useEffect, useMemo, useState } from 'react';
import { formatCompactIDR, formatIDR } from '../../utils/formatters';
import type { ReportSlice } from '../../utils/reporting';

interface ReportPieChartProps {
  slices: ReportSlice[];
  total: number;
  isPinkTheme: boolean;
  periodLabel: string;
}

const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE_WIDTH = 15;

export const ReportPieChart: React.FC<ReportPieChartProps> = ({
  slices,
  total,
  isPinkTheme,
  periodLabel,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId && !slices.some(slice => slice.id === activeId)) {
      setActiveId(null);
    }
  }, [slices, activeId]);

  const activeSlice = activeId ? slices.find(slice => slice.id === activeId) : undefined;

  const segments = useMemo(() => {
    let offset = 0;

    return slices.map(slice => {
      const length = total > 0 ? (slice.amount / total) * CIRCUMFERENCE : 0;
      const gap = slices.length > 1 ? Math.min(3, length * 0.35) : 0;
      const dash = Math.max(length - gap, 0.6);
      const segment = { ...slice, dash, offset };
      offset += length;
      return segment;
    });
  }, [slices, total]);

  const textTone = isPinkTheme ? 'text-[#37131D]' : 'text-slate-900 dark:text-white';
  const mutedTone = isPinkTheme ? 'text-pink-500/80' : 'text-slate-400';
  const trackTone = isPinkTheme ? 'text-pink-100' : 'text-slate-200 dark:text-slate-800';
  const idleRowTone = isPinkTheme
    ? 'hover:bg-pink-50/70'
    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60';
  const activeRowTone = isPinkTheme ? 'bg-pink-50' : 'bg-slate-100 dark:bg-slate-800';
  const centerValue = activeSlice ? activeSlice.amount : total;

  if (slices.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-center">
        <div
          className={`relative w-40 h-40 rounded-full border-[14px] flex items-center justify-center ${
            isPinkTheme ? 'border-pink-100' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="text-center">
            <div className={`text-sm font-extrabold tabular-nums ${textTone}`}>Rp 0</div>
            <div className={`text-[9px] font-semibold ${mutedTone}`}>Belum ada data</div>
          </div>
        </div>
        <p className={`text-[10px] mt-2 text-center ${mutedTone}`}>
          Belum ada pengeluaran pada periode ini.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mx-auto mt-2 w-40 h-40">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-full -rotate-90"
          role="group"
          aria-label={`Diagram pengeluaran ${periodLabel}`}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            stroke="currentColor"
            className={trackTone}
          />
          {segments.map(segment => {
            const isActive = activeId === segment.id;

            return (
              <circle
                key={segment.id}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={isActive ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
                opacity={activeId && !isActive ? 0.35 : 1}
                className="cursor-pointer transition-all duration-200 focus:outline-none"
                role="button"
                tabIndex={0}
                aria-label={`${segment.name}: ${formatIDR(segment.amount)} (${Math.round(
                  segment.percent
                )}%)`}
                aria-pressed={isActive}
                onClick={() => setActiveId(prev => (prev === segment.id ? null : segment.id))}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setActiveId(prev => (prev === segment.id ? null : segment.id));
                }}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-5">
          <span className={`text-[8px] font-bold uppercase tracking-wider truncate max-w-full ${mutedTone}`}>
            {activeSlice ? activeSlice.name : 'Total'}
          </span>
          <span className={`text-sm font-extrabold tabular-nums leading-tight ${textTone}`}>
            Rp {formatCompactIDR(centerValue)}
          </span>
          <span className={`text-[9px] font-semibold ${mutedTone}`}>
            {activeSlice ? `${Math.round(activeSlice.percent)}% pengeluaran` : 'Pengeluaran'}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-0.5">
        {slices.map(slice => {
          const isActive = activeId === slice.id;

          return (
            <button
              key={slice.id}
              type="button"
              onClick={() => setActiveId(prev => (prev === slice.id ? null : slice.id))}
              aria-pressed={isActive}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                isActive ? activeRowTone : idleRowTone
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className={`flex-1 min-w-0 truncate text-[10px] font-bold ${textTone}`}>
                {slice.name}
              </span>
              <span className={`text-[10px] font-bold tabular-nums shrink-0 ${textTone}`}>
                {formatIDR(slice.amount)}
              </span>
              <span
                className={`w-8 text-right text-[9px] font-bold tabular-nums shrink-0 ${mutedTone}`}
              >
                {Math.round(slice.percent)}%
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

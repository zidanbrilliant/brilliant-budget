import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X } from 'lucide-react';
import { formatNextRun, getNextRunForDay } from '../../utils/recurring';

const POPOVER_WIDTH = 296;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MIN_SPACE_BELOW = 360;

interface DayOfMonthFieldProps {
  value: number | null;
  onChange: (day: number | null) => void;
  ariaLabel: string;
  isPinkTheme: boolean;
  error?: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

export const DayOfMonthField: React.FC<DayOfMonthFieldProps> = ({
  value,
  onChange,
  ariaLabel,
  isPinkTheme,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const popoverId = useId();
  const valueId = useId();
  const errorId = useId();
  const today = new Date().getDate();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, centeredLeft),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
    );

    setPosition({
      top: openAbove ? undefined : rect.bottom + POPOVER_GAP,
      bottom: openAbove ? window.innerHeight - rect.top + POPOVER_GAP : undefined,
      left,
      width,
      maxHeight: Math.max(160, openAbove ? spaceAbove : spaceBelow),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const targetDay = value ?? today;
    const timer = window.setTimeout(() => {
      dayRefs.current[targetDay - 1]?.focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(timer);
    // Only focus when the picker opens; changing the value closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const togglePicker = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    updatePosition();
    setIsOpen(true);
  };

  const closePicker = () => {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const selectDay = (day: number) => {
    onChange(day);
    closePicker();
  };

  const clearDay = () => {
    onChange(null);
    closePicker();
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = dayRefs.current.findIndex(button => button === document.activeElement);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = Math.min(30, currentIndex + 1);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(30, currentIndex + 7);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - 7);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = 30;
        break;
      default:
        return;
    }

    event.preventDefault();
    dayRefs.current[nextIndex]?.focus({ preventScroll: true });
  };

  const fieldTone = error
    ? isPinkTheme
      ? 'bg-white border-rose-300 focus-within:border-rose-400'
      : 'bg-slate-100 dark:bg-slate-800 border-rose-300 dark:border-rose-500/60 focus-within:border-rose-400'
    : isPinkTheme
    ? 'bg-white border-pink-200 hover:border-pink-300 focus-within:border-pink-400'
    : 'bg-slate-100 dark:bg-slate-800 border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-slate-300 dark:focus-within:border-slate-500';
  const textTone = isPinkTheme
    ? 'text-[#37131D]'
    : 'text-slate-900 dark:text-slate-100';
  const placeholderTone = isPinkTheme ? 'text-pink-400' : 'text-slate-400';
  const iconTone = isPinkTheme ? 'text-pink-400' : 'text-slate-400 dark:text-slate-500';
  const clearTone = isPinkTheme
    ? 'text-pink-400 hover:text-rose-500 hover:bg-rose-50'
    : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40';
  const popoverTone = isPinkTheme
    ? 'bg-[#FFF5F7] border-pink-200'
    : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-700';
  const titleTone = isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white';
  const mutedTone = isPinkTheme ? 'text-pink-500/80' : 'text-slate-400';
  const idleDayTone = isPinkTheme
    ? 'text-[#4C1D2E] hover:bg-pink-100'
    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
  const selectedDayTone = isPinkTheme
    ? 'bg-rose-500 text-white shadow-xs shadow-rose-200'
    : 'bg-emerald-600 text-white shadow-xs';
  const todayTone = isPinkTheme
    ? 'text-rose-600 ring-1 ring-pink-300'
    : 'text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/70';
  const previewTone = isPinkTheme
    ? 'bg-white/70 border-pink-200/80'
    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';
  const footerBorder = isPinkTheme
    ? 'border-pink-200/70'
    : 'border-slate-200 dark:border-slate-700';
  const todayButtonTone = isPinkTheme
    ? 'text-pink-600 hover:bg-pink-100'
    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60';
  const clearButtonTone = isPinkTheme
    ? 'text-rose-500 hover:bg-rose-50'
    : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40';

  return (
    <div ref={wrapperRef} className="relative">
      <div className={`flex items-center w-full rounded-xl border transition ${fieldTone}`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={togglePicker}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? popoverId : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${valueId} ${errorId}` : valueId}
          className="flex-1 min-w-0 flex items-center gap-2 pl-2.5 pr-1.5 py-2.5 text-left outline-none rounded-xl"
        >
          <CalendarDays className={`w-4 h-4 shrink-0 ${iconTone}`} />
          <span
            id={valueId}
            className={`flex-1 truncate text-xs font-semibold tabular-nums ${
              value === null ? placeholderTone : textTone
            }`}
          >
            {value === null ? 'Pilih tanggal' : `Tgl ${value}`}
          </span>
        </button>
        {value !== null && (
          <button
            type="button"
            onClick={clearDay}
            aria-label="Hapus tanggal"
            className={`w-7 h-7 mr-1 rounded-lg flex items-center justify-center transition shrink-0 ${clearTone}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-[10px] text-rose-500 mt-1">
          {error}
        </p>
      )}

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label="Pilih tanggal"
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className={`z-[70] rounded-2xl border p-3 shadow-2xl animate-scale-up overflow-y-auto overscroll-contain scrollbar-none ${popoverTone}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`text-xs font-bold ${titleTone}`}>Pilih tanggal</div>
                <div className={`text-[10px] mt-0.5 ${mutedTone}`}>Berlaku setiap bulan</div>
              </div>
              <button
                type="button"
                onClick={closePicker}
                aria-label="Tutup pemilih tanggal"
                className={`w-6 h-6 rounded-md flex items-center justify-center transition ${clearTone}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className="grid grid-cols-7 gap-[3px] mt-3"
              onKeyDown={handleGridKeyDown}
            >
              {Array.from({ length: 35 }, (_, index) => {
                const day = index + 1;
                if (day > 31) {
                  return <div key={`empty-${index}`} aria-hidden="true" />;
                }

                const isSelected = value === day;
                const isToday = day === today;

                return (
                  <button
                    key={day}
                    ref={element => {
                      dayRefs.current[day - 1] = element;
                    }}
                    type="button"
                    onClick={() => selectDay(day)}
                    aria-label={`Tanggal ${day}`}
                    aria-pressed={isSelected}
                    className={`h-9 rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums transition ${
                      isSelected ? selectedDayTone : isToday ? todayTone : idleDayTone
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className={`mt-3 rounded-xl border px-2.5 py-2 ${previewTone}`}>
              <div className={`text-[9px] font-bold uppercase tracking-wider ${mutedTone}`}>
                Jatuh tempo berikutnya
              </div>
              <div className={`text-[11px] font-bold mt-0.5 ${titleTone}`}>
                {value === null ? 'Pilih tanggal dulu' : formatNextRun(getNextRunForDay(value))}
              </div>
              <div className={`text-[9px] mt-0.5 ${mutedTone}`}>
                Bulan pendek otomatis menyesuaikan.
              </div>
            </div>

            <div className={`flex items-center justify-between gap-2 mt-2.5 pt-2 border-t ${footerBorder}`}>
              <button
                type="button"
                onClick={() => selectDay(today)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${todayButtonTone}`}
              >
                Hari ini (tgl {today})
              </button>
              {value !== null && (
                <button
                  type="button"
                  onClick={clearDay}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${clearButtonTone}`}
                >
                  Hapus tanggal
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

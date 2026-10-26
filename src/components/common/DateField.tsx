import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const pad2 = (value: number) => String(value).padStart(2, '0');

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const isoToDisplay = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const formatTyping = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const displayToIso = (display: string) => {
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const toIso = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addMonths = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  isPinkTheme: boolean;
  placeholder?: string;
}

export const DateField: React.FC<DateFieldProps> = ({
  value,
  onChange,
  ariaLabel,
  isPinkTheme,
  placeholder = 'DD/MM/YYYY',
}) => {
  const [draft, setDraft] = useState(() => isoToDisplay(value));
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('below');
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? new Date(`${value}T12:00:00`) : new Date()
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();

  useEffect(() => {
    setDraft(isoToDisplay(value));
  }, [value]);

  // Keep the visible month in sync when a date is typed while the picker is open.
  useEffect(() => {
    if (isOpen && value) {
      setViewDate(new Date(`${value}T12:00:00`));
    }
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        calendarButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const commit = (iso: string) => {
    setDraft(isoToDisplay(iso));
    setError('');
    onChange(iso);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    // Support paste/autofill in ISO format (YYYY-MM-DD).
    const isoMatch = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const iso = displayToIso(`${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`);
      if (iso) {
        commit(iso);
        return;
      }
    }

    const formatted = formatTyping(raw);
    setDraft(formatted);
    setError('');

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 0) {
      onChange('');
      return;
    }

    if (digits.length === 8) {
      const iso = displayToIso(formatted);
      if (iso) onChange(iso);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Keep the field untouched when focus moves to the calendar or clear button.
    if (wrapperRef.current?.contains(event.relatedTarget as Node)) return;

    const digits = draft.replace(/\D/g, '');
    if (!digits) {
      setDraft('');
      setError('');
      if (value) onChange('');
      return;
    }

    const iso = displayToIso(draft);
    if (!iso) {
      const previous = isoToDisplay(value);
      setDraft(previous);
      setError(
        previous
          ? 'Tanggal tidak valid. Tanggal sebelumnya dipertahankan.'
          : 'Tanggal tidak valid. Gunakan format DD/MM/YYYY.'
      );
      return;
    }

    commit(iso);
  };

  const openCalendar = () => {
    const base = displayToIso(draft) || value;
    setViewDate(base ? new Date(`${base}T12:00:00`) : new Date());
    setError('');

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setPlacement(spaceBelow < 340 ? 'above' : 'below');
    }

    setIsOpen(open => !open);
  };

  const selectDate = (date: Date) => {
    commit(toIso(date));
    setIsOpen(false);
    calendarButtonRef.current?.focus();
  };

  const clearDate = () => {
    setDraft('');
    setError('');
    onChange('');
    setIsOpen(false);
    calendarButtonRef.current?.focus();
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewDate]);

  const todayIso = toIso(new Date());
  const hasValue = Boolean(draft || value);

  const fieldTone = error
    ? isPinkTheme
      ? 'bg-white border-rose-300 focus-within:border-rose-400'
      : 'bg-slate-100 dark:bg-slate-800 border-rose-300 dark:border-rose-500/60 focus-within:border-rose-400'
    : isPinkTheme
    ? 'bg-white border-pink-200 focus-within:border-pink-400'
    : 'bg-slate-100 dark:bg-slate-800 border-transparent focus-within:border-slate-300 dark:focus-within:border-slate-600';
  const textTone = isPinkTheme
    ? 'text-[#37131D] placeholder:text-pink-300'
    : 'text-slate-900 dark:text-slate-100 placeholder:text-slate-400';
  const iconTone = isPinkTheme
    ? 'text-pink-400 hover:text-pink-600 hover:bg-pink-100'
    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700';
  const navTone = isPinkTheme
    ? 'text-pink-500 hover:bg-pink-100'
    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
  const popoverTone = isPinkTheme
    ? 'bg-[#FFF5F7] border-pink-200'
    : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-700';
  const titleTone = isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white';
  const idleDayTone = isPinkTheme
    ? 'text-[#4C1D2E] hover:bg-pink-100'
    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
  const selectedDayTone = isPinkTheme
    ? 'bg-rose-500 text-white shadow-xs shadow-rose-200'
    : 'bg-emerald-600 text-white shadow-xs';
  const todayTone = isPinkTheme
    ? 'text-rose-600 ring-1 ring-pink-300'
    : 'text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/70';

  return (
    <div ref={wrapperRef} className="relative">
      <div className={`flex items-center w-full rounded-xl border transition ${fieldTone}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`flex-1 min-w-0 bg-transparent px-3 py-2 outline-none text-xs font-semibold tabular-nums ${textTone}`}
        />
        <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
          {hasValue && (
            <button
              type="button"
              onClick={clearDate}
              aria-label="Hapus tanggal"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${iconTone}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            ref={calendarButtonRef}
            type="button"
            onClick={openCalendar}
            aria-label={isOpen ? 'Tutup kalender' : 'Buka kalender'}
            aria-expanded={isOpen}
            className={`w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center transition ${iconTone}`}
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <p id={errorId} className="text-[10px] text-rose-500 mt-1">
          {error}
        </p>
      ) : (
        <p className={`text-[10px] mt-1 ${isPinkTheme ? 'text-pink-400/80' : 'text-slate-400'}`}>
          Ketik DD/MM/YYYY atau pilih dari kalender.
        </p>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Pilih tanggal"
          className={`absolute left-0 right-0 z-30 rounded-2xl border p-3 shadow-xl animate-scale-up ${
            placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${popoverTone}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isPinkTheme ? 'text-pink-500' : 'text-slate-400'
              }`}
            >
              Pilih tanggal
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                calendarButtonRef.current?.focus();
              }}
              aria-label="Tutup pemilih tanggal"
              className={`w-6 h-6 rounded-md flex items-center justify-center transition ${iconTone}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate(date => addMonths(date, -1))}
              aria-label="Bulan sebelumnya"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${navTone}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className={`text-xs font-bold ${titleTone}`}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(date => addMonths(date, 1))}
              aria-label="Bulan berikutnya"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${navTone}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1" aria-hidden="true">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="h-7 flex items-center justify-center text-[9px] font-bold text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} aria-hidden="true" />;
              }

              const iso = toIso(date);
              const isSelected = iso === value;
              const isToday = iso === todayIso;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDate(date)}
                  aria-label={date.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-pressed={isSelected}
                  className={`h-8 rounded-lg text-[11px] font-semibold tabular-nums transition ${
                    isSelected ? selectedDayTone : isToday ? todayTone : idleDayTone
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div
            className={`flex items-center justify-between gap-2 mt-2.5 pt-2 border-t ${
              isPinkTheme ? 'border-pink-200/70' : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                isPinkTheme
                  ? 'text-pink-600 hover:bg-pink-100'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
              }`}
            >
              Hari ini
            </button>
            {hasValue && (
              <button
                type="button"
                onClick={clearDate}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                  isPinkTheme
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                Hapus tenggat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

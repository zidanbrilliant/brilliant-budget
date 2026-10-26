const MONTHS_ID: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

function normalizeYear(value: number): number {
  if (value < 100) return 2000 + value;
  return value;
}

function isValidParts(parts: DateParts): boolean {
  if (parts.year < 2000 || parts.year > 2100) return false;
  if (parts.month < 1 || parts.month > 12) return false;
  if (parts.day < 1 || parts.day > 31) return false;
  const probe = new Date(parts.year, parts.month - 1, parts.day);
  return (
    probe.getFullYear() === parts.year &&
    probe.getMonth() === parts.month - 1 &&
    probe.getDate() === parts.day
  );
}

export function parseDateParts(raw: string): DateParts | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  // ISO: 2026-10-26 atau timestamp 2026-10-26T11:20:00
  const iso = value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const parts = {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
    return isValidParts(parts) ? parts : null;
  }

  // 26 Oktober 2026 / 08 OKT 2026
  const named = value.match(/(\d{1,2})\s+([a-z]+)\s+(\d{2,4})/i);
  if (named) {
    const month = MONTHS_ID[named[2].toLowerCase()];
    if (month) {
      const parts = {
        year: normalizeYear(Number(named[3])),
        month,
        day: Number(named[1]),
      };
      return isValidParts(parts) ? parts : null;
    }
  }

  // 26/10/2026, 26-10-2026, 26.10.2026 (default Indonesia: DD/MM/YYYY)
  const numeric = value.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    // Dukung input gaya US (MM/DD/YYYY) bila angkanya tidak mungkin sebagai tanggal Indonesia.
    if (month > 12 && day <= 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    const parts = {
      year: normalizeYear(Number(numeric[3])),
      month,
      day,
    };
    return isValidParts(parts) ? parts : null;
  }

  return null;
}

export function parseTimeParts(raw: string): { hour: number; minute: number } | null {
  const match = raw.trim().match(/(\d{1,2})[:.](\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function todayInJakarta(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Mengubah tanggal/jam dari AI atau struk menjadi timestamp lokal.
 * Bila tanggal tidak terbaca, gunakan `fallbackToday` (default hari ini WIB).
 */
export function parseDateAndTime(
  dateRaw?: string | null,
  timeRaw?: string | null,
  fallbackToday: string = todayInJakarta()
): number {
  const dateValue = (dateRaw || '').trim();
  const timeValue = (timeRaw || '').trim();
  const combined = [dateValue, timeValue].filter(Boolean).join(' ');

  const fallbackParts = parseDateParts(fallbackToday) || parseDateParts(todayInJakarta());
  const now = new Date();
  const fallback: DateParts = fallbackParts || {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };

  let parts: DateParts | null = null;
  if (/^(hari ini|today)$/i.test(dateValue)) {
    parts = fallback;
  } else if (/^(kemarin|yesterday)$/i.test(dateValue)) {
    const yesterday = new Date(fallback.year, fallback.month - 1, fallback.day - 1);
    parts = {
      year: yesterday.getFullYear(),
      month: yesterday.getMonth() + 1,
      day: yesterday.getDate(),
    };
  } else if (/^(besok|tomorrow)$/i.test(dateValue)) {
    const tomorrow = new Date(fallback.year, fallback.month - 1, fallback.day + 1);
    parts = {
      year: tomorrow.getFullYear(),
      month: tomorrow.getMonth() + 1,
      day: tomorrow.getDate(),
    };
  } else {
    parts = parseDateParts(dateValue) || parseDateParts(combined) || fallback;
  }

  const time = parseTimeParts(timeValue) || parseTimeParts(dateValue) || null;
  const isToday =
    parts.year === fallback.year && parts.month === fallback.month && parts.day === fallback.day;

  const hour = time ? time.hour : isToday ? now.getHours() : 12;
  const minute = time ? time.minute : isToday ? now.getMinutes() : 0;
  const timestamp = new Date(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0).getTime();

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function formatDateTimeID(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateID(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

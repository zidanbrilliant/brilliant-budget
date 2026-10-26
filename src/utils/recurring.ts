/**
 * Returns the next timestamp a monthly rule with the given day-of-month will run.
 * Days beyond the length of a month are clamped to that month's last day.
 */
export const getNextRunForDay = (day: number, from: Date = new Date()) => {
  const safeDay = Math.min(Math.max(1, Math.round(day) || 1), 31);
  const build = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(safeDay, lastDay), 8, 0, 0, 0).getTime();
  };

  let next = build(from.getFullYear(), from.getMonth());
  if (next <= from.getTime()) next = build(from.getFullYear(), from.getMonth() + 1);
  return next;
};

export const formatNextRun = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

import { dayKey } from './dates';

// Hora efectiva de un evento de "todo el día" para avisos y orden
export const ALL_DAY_HOUR = 9;

function occurrenceAt(base, repeat, n) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const h = base.getHours();
  const min = base.getMinutes();
  let date;
  switch (repeat) {
    case 'daily': date = new Date(y, m, d + n, h, min); break;
    case 'weekly': date = new Date(y, m, d + 7 * n, h, min); break;
    case 'monthly': date = new Date(y, m + n, d, h, min); break;
    case 'yearly': date = new Date(y + n, m, d, h, min); break;
    default: return n === 0 ? base : null;
  }
  // Si el mes no tiene ese día (p. ej. 31), se salta esa ocurrencia
  if ((repeat === 'monthly' || repeat === 'yearly') && date.getDate() !== d) return undefined;
  return date;
}

function baseStart(event) {
  const s = new Date(event.start_at);
  if (event.all_day) s.setHours(ALL_DAY_HOUR, 0, 0, 0);
  return s;
}

/** Devuelve las ocurrencias de un evento cuya fecha cae entre `from` y `to`. */
export function occurrences(event, from, to) {
  const base = baseStart(event);
  const duration = event.end_at ? new Date(event.end_at) - new Date(event.start_at) : 0;
  const until = event.repeat_until ? new Date(event.repeat_until) : null;
  const out = [];
  for (let n = 0; n < 5000; n++) {
    const at = occurrenceAt(base, event.repeat, n);
    if (at === null) break;
    if (at === undefined) continue;
    if (at > to || (until && at > until)) break;
    if (at >= from || (duration && new Date(at.getTime() + duration) >= from)) {
      const key = dayKey(at);
      out.push({
        id: `${event.id}_${key}`,
        event,
        start: at,
        end: duration ? new Date(at.getTime() + duration) : null,
        key,
        done: event.done_dates?.includes(key) ?? false,
      });
    }
    if (event.repeat === 'none') break;
  }
  return out;
}

export function allOccurrences(events, from, to) {
  return events
    .flatMap((e) => occurrences(e, from, to))
    .sort((a, b) => a.start - b.start || Number(a.done) - Number(b.done));
}

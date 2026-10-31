const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a, b) => dayKey(a) === dayKey(b);

export const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const formatLongDate = (d) => `${cap(DAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
export const formatShortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
export const formatMonthYear = (d) => `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`;

export function relativeDay(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff < 7) return cap(DAYS[d.getDay()]);
  return formatLongDate(d);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function reminderLabel(min) {
  if (min === 0) return 'Es ahora';
  if (min % 1440 === 0) return min === 1440 ? 'Mañana' : `En ${min / 1440} días`;
  if (min % 60 === 0) return min === 60 ? 'En 1 hora' : `En ${min / 60} horas`;
  return `En ${min} minutos`;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

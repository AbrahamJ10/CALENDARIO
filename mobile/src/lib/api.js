import { neon } from '@neondatabase/serverless';

// Usuario "agenda_app" de Neon: solo puede leer/escribir la tabla events
const DATABASE_URL = process.env.EXPO_PUBLIC_DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

const CATEGORIES = ['trabajo', 'personal', 'reunion', 'salud', 'pago', 'estudio', 'otro'];
const PRIORITIES = ['alta', 'media', 'baja'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

function clean(body) {
  const e = {
    title: String(body.title || '').trim(),
    description: String(body.description || ''),
    location: String(body.location || ''),
    category: CATEGORIES.includes(body.category) ? body.category : 'personal',
    priority: PRIORITIES.includes(body.priority) ? body.priority : 'media',
    start_at: body.start_at ? new Date(body.start_at) : null,
    end_at: body.end_at ? new Date(body.end_at) : null,
    all_day: !!body.all_day,
    reminders: Array.isArray(body.reminders)
      ? [...new Set(body.reminders.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60 * 24 * 30))]
      : [1440, 60, 0],
    repeat: REPEATS.includes(body.repeat) ? body.repeat : 'none',
    nag_every: Number.isInteger(Number(body.nag_every)) ? Math.min(Math.max(Number(body.nag_every), 0), 720) : 60,
  };
  if (!e.title) throw new Error('El título es obligatorio');
  if (!e.start_at || isNaN(e.start_at)) throw new Error('Fecha de inicio inválida');
  if (e.end_at && (isNaN(e.end_at) || e.end_at < e.start_at)) throw new Error('La hora de fin debe ser posterior al inicio');
  return [e.title, e.description, e.location, e.category, e.priority, e.start_at.toISOString(),
    e.end_at ? e.end_at.toISOString() : null, e.all_day, e.reminders, e.repeat, e.nag_every];
}

async function query(text, params) {
  if (!sql) throw new Error('Falta configurar la base de datos');
  try {
    return await sql.query(text, params);
  } catch (err) {
    if (/fetch|network|Network request failed|timed? ?out/i.test(err.message)) throw new Error('Sin internet: no se pudo guardar');
    throw err;
  }
}

const one = async (text, params) => {
  const rows = await query(text, params);
  if (!rows[0]) throw new Error('La actividad ya no existe');
  return rows[0];
};

export const api = {
  health: () => query('SELECT 1 AS ok'),
  list: () => query('SELECT * FROM events ORDER BY start_at'),
  create: (data) => one(
    `INSERT INTO events (title, description, location, category, priority, start_at, end_at, all_day, reminders, repeat, nag_every)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    clean(data),
  ),
  update: (id, data) => one(
    `UPDATE events SET title=$2, description=$3, location=$4, category=$5, priority=$6, start_at=$7, end_at=$8,
       all_day=$9, reminders=$10, repeat=$11, nag_every=$12, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, ...clean(data)],
  ),
  // Marca como hecha (sin desmarcar si ya lo estaba): lo usan las alertas
  setDone: (id, date) => one(
    `UPDATE events SET done_dates = CASE WHEN $2 = ANY(done_dates) THEN done_dates ELSE array_append(done_dates, $2) END,
       updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, date],
  ),
  remove: (id) => query('DELETE FROM events WHERE id=$1', [id]),
  // Marca o desmarca como hecha una ocurrencia concreta (fecha YYYY-MM-DD)
  toggle: (id, date) => one(
    `UPDATE events SET done_dates = CASE WHEN $2 = ANY(done_dates) THEN array_remove(done_dates, $2) ELSE array_append(done_dates, $2) END,
       updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, date],
  ),
};

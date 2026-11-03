require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const { DATABASE_URL, API_KEY, PORT = 3000 } = process.env;
if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

const CATEGORIES = ['trabajo', 'personal', 'reunion', 'salud', 'pago', 'estudio', 'otro'];
const PRIORITIES = ['alta', 'media', 'baja'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location    TEXT NOT NULL DEFAULT '',
      category    TEXT NOT NULL DEFAULT 'personal',
      priority    TEXT NOT NULL DEFAULT 'media',
      start_at    TIMESTAMPTZ NOT NULL,
      end_at      TIMESTAMPTZ,
      all_day     BOOLEAN NOT NULL DEFAULT FALSE,
      reminders   INTEGER[] NOT NULL DEFAULT '{15}',
      repeat      TEXT NOT NULL DEFAULT 'none',
      repeat_until TIMESTAMPTZ,
      done_dates  TEXT[] NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS events_start_idx ON events (start_at);
    ALTER TABLE events ADD COLUMN IF NOT EXISTS nag_every INTEGER NOT NULL DEFAULT 60;
    -- Dueño de la agenda (nombre normalizado del usuario de la app)
    ALTER TABLE events ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS events_owner_start_idx ON events (owner, start_at);
  `);
}

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
    repeat_until: body.repeat_until ? new Date(body.repeat_until) : null,
    // Cada cuántos minutos insistir tras la hora del evento hasta marcarlo como realizado (0 = no insistir)
    nag_every: Number.isInteger(Number(body.nag_every)) ? Math.min(Math.max(Number(body.nag_every), 0), 720) : 60,
  };
  if (!e.title) return { error: 'El título es obligatorio' };
  if (!e.start_at || isNaN(e.start_at)) return { error: 'Fecha de inicio inválida' };
  if (e.end_at && (isNaN(e.end_at) || e.end_at < e.start_at)) return { error: 'La fecha de fin debe ser posterior al inicio' };
  if (e.repeat_until && isNaN(e.repeat_until)) e.repeat_until = null;
  return { event: e };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

app.use((req, res, next) => {
  if (API_KEY && req.get('x-api-key') !== API_KEY) return res.status(401).json({ error: 'Clave de acceso inválida' });
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

app.get('/events', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY start_at');
  res.json(rows);
}));

app.post('/events', wrap(async (req, res) => {
  const { event: e, error } = clean(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, location, category, priority, start_at, end_at, all_day, reminders, repeat, repeat_until, nag_every)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [e.title, e.description, e.location, e.category, e.priority, e.start_at, e.end_at, e.all_day, e.reminders, e.repeat, e.repeat_until, e.nag_every],
  );
  res.status(201).json(rows[0]);
}));

app.put('/events/:id', wrap(async (req, res) => {
  const { event: e, error } = clean(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `UPDATE events SET title=$2, description=$3, location=$4, category=$5, priority=$6, start_at=$7, end_at=$8,
       all_day=$9, reminders=$10, repeat=$11, repeat_until=$12, nag_every=$13, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [req.params.id, e.title, e.description, e.location, e.category, e.priority, e.start_at, e.end_at, e.all_day, e.reminders, e.repeat, e.repeat_until, e.nag_every],
  );
  if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
}));

// Marca o desmarca como hecha una ocurrencia concreta (fecha YYYY-MM-DD)
app.post('/events/:id/toggle', wrap(async (req, res) => {
  const date = String(req.body.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Fecha inválida' });
  const { rows } = await pool.query(
    `UPDATE events SET done_dates = CASE WHEN $2 = ANY(done_dates) THEN array_remove(done_dates, $2) ELSE array_append(done_dates, $2) END,
       updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [req.params.id, date],
  );
  if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
}));

app.delete('/events/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

migrate()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`API de Agenda escuchando en el puerto ${PORT}`)))
  .catch((err) => {
    console.error('No se pudo preparar la base de datos:', err.message);
    process.exit(1);
  });

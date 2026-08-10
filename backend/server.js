'use strict';

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'db.sqlite3');
const PORT = process.env.PORT || 3000;
const LOGIN_CODE = process.env.LOGIN_CODE || '1234';

const db = new DatabaseSync(DB_PATH);

// Migrationen
try { db.exec(`ALTER TABLE benutzer ADD COLUMN nachname TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE benutzer ADD COLUMN bezeichnung TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE benutzer ADD COLUMN foto TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`UPDATE benutzer SET nachname = '' WHERE nachname IS NULL`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS benutzer (
    id          TEXT PRIMARY KEY,
    vorname     TEXT NOT NULL,
    nachname    TEXT NOT NULL DEFAULT '',
    telefon     TEXT NOT NULL DEFAULT '',
    bezeichnung TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS schuld (
    id          TEXT PRIMARY KEY,
    benutzer_id TEXT NOT NULL REFERENCES benutzer(id),
    bezeichnung TEXT NOT NULL,
    betrag      REAL NOT NULL,
    datum       TEXT NOT NULL,
    bezahlt     INTEGER NOT NULL DEFAULT 0,
    bezahlt_am  TEXT
  );

  CREATE TABLE IF NOT EXISTS token (
    token      TEXT PRIMARY KEY,
    erstellt_am TEXT NOT NULL
  );
`);

function newId() {
  return crypto.randomUUID();
}

function toBenutzer(row) {
  return { id: row.id, vorname: row.vorname, nachname: row.nachname ?? '', telefon: row.telefon ?? '', bezeichnung: row.bezeichnung ?? '', foto: row.foto ?? '' };
}

function toSchuld(row) {
  return {
    id: row.id,
    benutzerId: row.benutzer_id,
    bezeichnung: row.bezeichnung,
    betrag: row.betrag,
    datum: row.datum,
    bezahlt: row.bezahlt === 1,
    ...(row.bezahlt_am ? { bezahltAm: row.bezahlt_am } : {}),
  };
}

function isValidToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return false;
  const row = db.prepare('SELECT token, erstellt_am FROM token WHERE token = ?').get(token);
  if (!row) return false;
  const age = Date.now() - new Date(row.erstellt_am).getTime();
  return age < 7 * 24 * 60 * 60 * 1000;
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function auth(req, res, next) {
  if (!isValidToken(req)) return res.status(401).json({ message: 'Nicht autorisiert' });
  next();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { code } = req.body || {};
  if (code !== LOGIN_CODE) return res.status(401).json({ message: 'Ungültiger Code' });
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO token (token, erstellt_am) VALUES (?, ?)').run(token, new Date().toISOString());
  res.json({ token });
});

app.post('/api/auth/refresh', auth, (req, res) => {
  const oldToken = req.headers['authorization'].slice(7);
  const newToken = crypto.randomUUID();
  db.prepare('DELETE FROM token WHERE token = ?').run(oldToken);
  db.prepare('INSERT INTO token (token, erstellt_am) VALUES (?, ?)').run(newToken, new Date().toISOString());
  res.json({ token: newToken });
});

// ── Public ────────────────────────────────────────────────────────────────────

app.get('/api/public/benutzer/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM benutzer WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  res.json(toBenutzer(row));
});

app.get('/api/public/benutzer/:id/schulden', (req, res) => {
  const benutzer = db.prepare('SELECT id FROM benutzer WHERE id = ?').get(req.params.id);
  if (!benutzer) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  const rows = db.prepare(
    'SELECT * FROM schuld WHERE benutzer_id = ? AND bezahlt = 0 ORDER BY datum DESC'
  ).all(req.params.id);
  res.json(rows.map(toSchuld));
});

// ── Benutzer ──────────────────────────────────────────────────────────────────

app.get('/api/benutzer', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM benutzer ORDER BY nachname, vorname').all();
  res.json(rows.map(toBenutzer));
});

app.get('/api/benutzer/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM benutzer WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  res.json(toBenutzer(row));
});

app.post('/api/benutzer', auth, (req, res) => {
  const { vorname, nachname, telefon, bezeichnung } = req.body || {};
  if (!vorname) return res.status(400).json({ message: 'vorname erforderlich' });
  const id = newId();
  db.prepare('INSERT INTO benutzer (id, vorname, nachname, telefon, bezeichnung, foto) VALUES (?, ?, ?, ?, ?, ?)').run(id, vorname, nachname ?? '', telefon ?? '', bezeichnung ?? '', '');
  res.status(201).json({ id, vorname, nachname: nachname ?? '', telefon: telefon ?? '', bezeichnung: bezeichnung ?? '', foto: '' });
});

app.patch('/api/benutzer/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM benutzer WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  const vorname     = req.body.vorname     ?? row.vorname;
  const nachname    = req.body.nachname    ?? row.nachname;
  const telefon     = req.body.telefon     ?? row.telefon;
  const bezeichnung = req.body.bezeichnung ?? row.bezeichnung;
  const foto        = req.body.foto        ?? row.foto;
  db.prepare('UPDATE benutzer SET vorname = ?, nachname = ?, telefon = ?, bezeichnung = ?, foto = ? WHERE id = ?').run(vorname, nachname, telefon, bezeichnung, foto, req.params.id);
  res.json({ id: req.params.id, vorname, nachname, telefon, bezeichnung, foto });
});

app.delete('/api/benutzer/:id', auth, (req, res) => {
  const row = db.prepare('SELECT id FROM benutzer WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  db.prepare('DELETE FROM schuld WHERE benutzer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM benutzer WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ── Schulden ──────────────────────────────────────────────────────────────────

app.get('/api/benutzer/:benutzerId/schulden', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM schuld WHERE benutzer_id = ? ORDER BY datum DESC').all(req.params.benutzerId);
  res.json(rows.map(toSchuld));
});

app.post('/api/schulden', auth, (req, res) => {
  const { benutzerId, bezeichnung, betrag, datum } = req.body || {};
  if (!benutzerId || !bezeichnung || betrag == null || !datum) {
    return res.status(400).json({ message: 'benutzerId, bezeichnung, betrag und datum erforderlich' });
  }
  const benutzer = db.prepare('SELECT id FROM benutzer WHERE id = ?').get(benutzerId);
  if (!benutzer) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
  const id = newId();
  db.prepare('INSERT INTO schuld (id, benutzer_id, bezeichnung, betrag, datum, bezahlt) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, benutzerId, bezeichnung, betrag, datum);
  res.status(201).json({ id, benutzerId, bezeichnung, betrag, datum, bezahlt: false });
});

app.patch('/api/schulden/:schuldId/bezahlt', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM schuld WHERE id = ?').get(req.params.schuldId);
  if (!row) return res.status(404).json({ message: 'Schuld nicht gefunden' });
  const bezahltAm = new Date().toISOString().slice(0, 10);
  db.prepare('UPDATE schuld SET bezahlt = 1, bezahlt_am = ? WHERE id = ?').run(bezahltAm, req.params.schuldId);
  res.json(toSchuld({ ...row, bezahlt: 1, bezahlt_am: bezahltAm }));
});

app.patch('/api/schulden/:schuldId/offen', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM schuld WHERE id = ?').get(req.params.schuldId);
  if (!row) return res.status(404).json({ message: 'Schuld nicht gefunden' });
  db.prepare('UPDATE schuld SET bezahlt = 0, bezahlt_am = NULL WHERE id = ?').run(req.params.schuldId);
  res.json(toSchuld({ ...row, bezahlt: 0, bezahlt_am: null }));
});

app.delete('/api/schulden/:schuldId', auth, (req, res) => {
  const row = db.prepare('SELECT id FROM schuld WHERE id = ?').get(req.params.schuldId);
  if (!row) return res.status(404).json({ message: 'Schuld nicht gefunden' });
  db.prepare('DELETE FROM schuld WHERE id = ?').run(req.params.schuldId);
  res.status(204).send();
});

// ── Angular-Frontend ausliefern ───────────────────────────────────────────────

// Pfad zum Angular-Build: dist/TestHenri
const angularDistPath = path.join(__dirname, '../dist/TestHenri');

// Statische Dateien (JS, CSS, Assets) ausliefern
app.use(express.static(angularDistPath));

// Alle nicht-API-Routen an Angular weitergeben (SPA)
app.get('*', (req, res) => {
  // API-Routen sollen weiterhin von oben behandelt werden,
  // hier landen alle "sonstigen" Pfade (/, /something, /user/123, ...)
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

// ── Serverstart ───────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Backend + Frontend läuft auf http://localhost:${PORT}`);
  console.log(`Login-Code: ${LOGIN_CODE}`);
  console.log(`Datenbank: ${DB_PATH}`);
});

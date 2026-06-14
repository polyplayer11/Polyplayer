// db.js
// Database setup using Node's built-in 'node:sqlite' module.
// No external dependencies — works with `node server.js` directly.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { hashPassword } = require('./lib/auth');

const db = new DatabaseSync(path.join(__dirname, 'data', 'wallet.db'));

// ===== Schema =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT DEFAULT 'default',
    coins INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stake INTEGER NOT NULL DEFAULT 1,
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 2,
    realtime INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    pot INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    winner_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    stake_paid INTEGER NOT NULL,
    PRIMARY KEY (match_id, user_id),
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ===== Seed default game: Tac-Grid =====
const gameCount = db.prepare('SELECT COUNT(*) AS c FROM games').get().c;
if (gameCount === 0) {
  db.prepare(`
    INSERT INTO games (id, name, stake, min_players, max_players, realtime, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('tacgrid', 'Tac-Grid', 2, 2, 2, 1, 1);
}

// ===== Seed default admin account =====
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!adminExists) {
  const hash = hashPassword(ADMIN_PASSWORD);
  db.prepare(`
    INSERT INTO users (username, password_hash, display_name, coins, is_admin)
    VALUES (?, ?, ?, ?, 1)
  `).run(ADMIN_USERNAME, hash, 'Command HQ', 0);
  console.log(`Seeded admin account -> username: ${ADMIN_USERNAME}, password: ${ADMIN_PASSWORD}`);
  console.log('IMPORTANT: change this password after first login (set ADMIN_USERNAME/ADMIN_PASSWORD env vars before first run).');
}

module.exports = db;

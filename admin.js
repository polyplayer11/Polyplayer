// routes/admin.js
const { HttpError } = require('../lib/http-helpers');

function listUsers(ctx) {
  const users = ctx.db.prepare(`
    SELECT id, username, display_name, icon, coins, is_admin, created_at, last_login
    FROM users
    ORDER BY last_login DESC NULLS LAST, id ASC
  `).all();

  return { status: 200, body: { users: users.map(u => ({ ...u, is_admin: !!u.is_admin })) } };
}

function adjustCoins(ctx) {
  const userId = Number(ctx.params.id);
  const { amount, description } = ctx.body || {};

  if (!Number.isInteger(amount) || amount === 0) {
    throw new HttpError(400, 'Amount must be a non-zero whole number.');
  }

  const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new HttpError(404, 'User not found.');

  const newBalance = user.coins + amount;
  if (newBalance < 0) {
    throw new HttpError(400, `That would make the balance negative (current: ${user.coins}).`);
  }

  ctx.db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, userId);
  ctx.db.prepare(`
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    amount,
    amount > 0 ? 'admin_credit' : 'admin_debit',
    description || (amount > 0 ? 'Coins added by admin' : 'Coins removed by admin')
  );

  return { status: 200, body: { user: { id: user.id, username: user.username, coins: newBalance } } };
}

function listGames(ctx) {
  const games = ctx.db.prepare('SELECT * FROM games ORDER BY id').all();
  return {
    status: 200,
    body: { games: games.map(g => ({ ...g, realtime: !!g.realtime, active: !!g.active })) },
  };
}

function updateGame(ctx) {
  const gameId = ctx.params.id;
  const existing = ctx.db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!existing) throw new HttpError(404, 'Game not found.');

  const { name, stake, min_players, max_players, realtime, active } = ctx.body || {};
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(String(name).slice(0, 40)); }
  if (stake !== undefined) {
    if (!Number.isInteger(stake) || stake < 0) throw new HttpError(400, 'Stake must be a non-negative whole number.');
    updates.push('stake = ?'); params.push(stake);
  }
  if (min_players !== undefined) {
    if (!Number.isInteger(min_players) || min_players < 2) throw new HttpError(400, 'Minimum players must be 2 or more.');
    updates.push('min_players = ?'); params.push(min_players);
  }
  if (max_players !== undefined) {
    if (!Number.isInteger(max_players) || max_players < 2) throw new HttpError(400, 'Maximum players must be 2 or more.');
    updates.push('max_players = ?'); params.push(max_players);
  }
  if (realtime !== undefined) { updates.push('realtime = ?'); params.push(realtime ? 1 : 0); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

  if (updates.length === 0) throw new HttpError(400, 'Nothing to update.');

  params.push(gameId);
  ctx.db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = ctx.db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  return { status: 200, body: { game: { ...updated, realtime: !!updated.realtime, active: !!updated.active } } };
}

function createGame(ctx) {
  const { id, name, stake, min_players, max_players, realtime } = ctx.body || {};

  if (!id || !/^[a-z0-9_-]{2,30}$/.test(id)) {
    throw new HttpError(400, 'Game id must be lowercase letters/numbers/hyphens, 2-30 chars.');
  }
  if (!name) throw new HttpError(400, 'Game name is required.');

  const existing = ctx.db.prepare('SELECT id FROM games WHERE id = ?').get(id);
  if (existing) throw new HttpError(409, 'A game with that id already exists.');

  ctx.db.prepare(`
    INSERT INTO games (id, name, stake, min_players, max_players, realtime, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    String(name).slice(0, 40),
    Number.isInteger(stake) ? stake : 1,
    Number.isInteger(min_players) ? min_players : 2,
    Number.isInteger(max_players) ? max_players : 2,
    realtime === false ? 0 : 1
  );

  const game = ctx.db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  return { status: 201, body: { game: { ...game, realtime: !!game.realtime, active: !!game.active } } };
}

function listMatches(ctx) {
  const matches = ctx.db.prepare(`
    SELECT m.id, m.game_id, m.pot, m.status, m.winner_user_id, m.created_at, m.finished_at,
           u.username AS winner_username
    FROM matches m
    LEFT JOIN users u ON u.id = m.winner_user_id
    ORDER BY m.id DESC
    LIMIT 50
  `).all();

  return { status: 200, body: { matches } };
}

module.exports = { listUsers, adjustCoins, listGames, updateGame, createGame, listMatches };

// routes/wallet.js
const { HttpError } = require('./http-helpers');
const { publicUser } = require('./auth-routes');

const ICONS = ['default', 'fox', 'wolf', 'eagle', 'bear', 'cobra', 'ghost', 'panther'];

function me(ctx) {
  const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
  if (!user) throw new HttpError(404, 'Account not found.');
  return { status: 200, body: { user: publicUser(user) } };
}

function transactions(ctx) {
  const rows = ctx.db.prepare(`
    SELECT amount, type, description, created_at
    FROM transactions
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 50
  `).all(ctx.user.id);

  return { status: 200, body: { transactions: rows } };
}

function updateProfile(ctx) {
  const { display_name, icon } = ctx.body || {};
  const updates = [];
  const params = [];

  if (display_name !== undefined) {
    const name = String(display_name).trim();
    if (!name || name.length > 30) {
      throw new HttpError(400, 'Display name must be 1-30 characters.');
    }
    updates.push('display_name = ?');
    params.push(name);
  }

  if (icon !== undefined) {
    if (!ICONS.includes(icon)) {
      throw new HttpError(400, `Icon must be one of: ${ICONS.join(', ')}`);
    }
    updates.push('icon = ?');
    params.push(icon);
  }

  if (updates.length === 0) {
    throw new HttpError(400, 'Nothing to update.');
  }

  params.push(ctx.user.id);
  ctx.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
  return { status: 200, body: { user: publicUser(user) } };
}

function games(ctx) {
  const rows = ctx.db.prepare(
    'SELECT id, name, stake, min_players, max_players, realtime FROM games WHERE active = 1'
  ).all();
  return { status: 200, body: { games: rows.map(g => ({ ...g, realtime: !!g.realtime })) } };
}

function icons() {
  return { status: 200, body: { icons: ICONS } };
}

module.exports = { me, transactions, updateProfile, games, icons, ICONS };

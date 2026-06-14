// routes/auth.js
const { hashPassword, verifyPassword, sign } = require('./auth');
const { HttpError } = require('./http-helpers');

const SIGNUP_BONUS = 10;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    icon: user.icon,
    coins: user.coins,
    is_admin: !!user.is_admin,
  };
}

function register(ctx) {
  const { username, password, display_name } = ctx.body || {};

  if (!username || !password) {
    throw new HttpError(400, 'Username and password are required.');
  }
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'Username must be 3-20 characters: letters, numbers, underscores only.');
  }
  if (password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters.');
  }

  const existing = ctx.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    throw new HttpError(409, 'That username is already taken.');
  }

  const hash = hashPassword(password);
  const name = (display_name || username).toString().slice(0, 30);

  const result = ctx.db.prepare(`
    INSERT INTO users (username, password_hash, display_name, coins, last_login)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(username, hash, name, SIGNUP_BONUS);

  ctx.db.prepare(`
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (?, ?, 'signup_bonus', 'Welcome bonus on signup')
  `).run(result.lastInsertRowid, SIGNUP_BONUS);

  const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = sign({ id: user.id, username: user.username, is_admin: !!user.is_admin });

  return { status: 201, body: { token, user: publicUser(user) } };
}

function login(ctx) {
  const { username, password } = ctx.body || {};

  if (!username || !password) {
    throw new HttpError(400, 'Username and password are required.');
  }

  const user = ctx.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect username or password.');
  }

  ctx.db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

  const token = sign({ id: user.id, username: user.username, is_admin: !!user.is_admin });
  return { status: 200, body: { token, user: publicUser(user) } };
}

module.exports = { register, login, publicUser };

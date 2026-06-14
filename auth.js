// lib/auth.js
// Password hashing + lightweight session tokens, using only Node's
// built-in 'crypto' module — no external dependencies required.

const crypto = require('crypto');

const SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-this-before-going-live';
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ===== Password hashing (scrypt) =====
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  // constant-time comparison
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ===== Session tokens (HMAC-signed, JWT-like but minimal) =====
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function sign(payloadObj) {
  const payload = { ...payloadObj, exp: Date.now() + TOKEN_LIFETIME_MS };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = base64url(crypto.createHmac('sha256', SECRET).update(payloadB64).digest());

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(payloadB64).toString('utf8'));
  } catch (e) {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

module.exports = { hashPassword, verifyPassword, sign, verify };

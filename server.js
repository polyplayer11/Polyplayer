require = require;
const http = require('http');
const path = require('path');
const fs = require('fs');

// Flat structure - all files in same folder
process.chdir(__dirname);

const db = require('./db');
const { verify } = require('./auth');
const { sendJson, readJsonBody, Router, serveStatic, HttpError } = require('./http-helpers');
const authRoutes = require('./auth-routes');
const walletRoutes = require('./wallet-routes');
const adminRoutes = require('./admin-routes');

const PUBLIC_DIR = __dirname;
const PORT = process.env.PORT || 3000;

function getUser(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  return verify(token);
}

const router = new Router();

router.post('/api/auth/register', async (req, res) => {
  const body = await readJsonBody(req);
  const result = authRoutes.register({ db, body });
  sendJson(res, result.status, result.body);
});

router.post('/api/auth/login', async (req, res) => {
  const body = await readJsonBody(req);
  const result = authRoutes.login({ db, body });
  sendJson(res, result.status, result.body);
});

router.get('/api/wallet/me', (req, res) => {
  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: 'Login required.' });
  const result = walletRoutes.me({ db, user });
  sendJson(res, result.status, result.body);
});

router.get('/api/wallet/transactions', (req, res) => {
  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: 'Login required.' });
  const result = walletRoutes.transactions({ db, user });
  sendJson(res, result.status, result.body);
});

router.put('/api/wallet/profile', async (req, res) => {
  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: 'Login required.' });
  const body = await readJsonBody(req);
  const result = walletRoutes.updateProfile({ db, user, body });
  sendJson(res, result.status, result.body);
});

router.get('/api/wallet/games', (req, res) => {
  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: 'Login required.' });
  const result = walletRoutes.games({ db, user });
  sendJson(res, result.status, result.body);
});

router.get('/api/wallet/icons', (req, res) => {
  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: 'Login required.' });
  const result = walletRoutes.icons();
  sendJson(res, result.status, result.body);
});

function adminCtx(req, res, extraCtx = {}) {
  const user = getUser(req);
  if (!user) { sendJson(res, 401, { error: 'Login required.' }); return null; }
  if (!user.is_admin) { sendJson(res, 403, { error: 'Admin access required.' }); return null; }
  return { db, user, ...extraCtx };
}

router.get('/api/admin/users', (req, res) => {
  const ctx = adminCtx(req, res);
  if (!ctx) return;
  const result = adminRoutes.listUsers(ctx);
  sendJson(res, result.status, result.body);
});

router.post('/api/admin/users/:id/coins', async (req, res) => {
  const ctx = adminCtx(req, res, { params: req._params });
  if (!ctx) return;
  const body = await readJsonBody(req);
  const result = adminRoutes.adjustCoins({ ...ctx, body });
  sendJson(res, result.status, result.body);
});

router.get('/api/admin/games', (req, res) => {
  const ctx = adminCtx(req, res);
  if (!ctx) return;
  const result = adminRoutes.listGames(ctx);
  sendJson(res, result.status, result.body);
});

router.post('/api/admin/games', async (req, res) => {
  const ctx = adminCtx(req, res);
  if (!ctx) return;
  const body = await readJsonBody(req);
  const result = adminRoutes.createGame({ ...ctx, body });
  sendJson(res, result.status, result.body);
});

router.put('/api/admin/games/:id', async (req, res) => {
  const ctx = adminCtx(req, res, { params: req._params });
  if (!ctx) return;
  const body = await readJsonBody(req);
  const result = adminRoutes.updateGame({ ...ctx, body });
  sendJson(res, result.status, result.body);
});

router.get('/api/admin/matches', (req, res) => {
  const ctx = adminCtx(req, res);
  if (!ctx) return;
  const result = adminRoutes.listMatches(ctx);
  sendJson(res, result.status, result.body);
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const matched = router.match(req.method, pathname);
    if (!matched) return sendJson(res, 404, { error: 'API endpoint not found.' });
    req._params = matched.params;
    try {
      await matched.handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        console.error('Error:', err);
        sendJson(res, 500, { error: 'Something went wrong.' });
      }
    }
    return;
  }

  // Serve index.html for all non-API routes
  const indexPath = path.join(__dirname, 'index.html');
  fs.readFile(indexPath, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Battle Arena running on port ${PORT}`);
});

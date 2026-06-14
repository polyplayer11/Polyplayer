BATTLE ARENA WALLET SITE
=========================
Zero external dependencies — runs with Node.js only.

HOW TO START:
  node server.js

Opens at: http://localhost:3000

DEFAULT ADMIN LOGIN:
  username: admin
  password: admin123
  (Change this before going live!)

FOLDER STRUCTURE:
  server.js          — main server (start here)
  db.js              — database setup + seed data
  lib/auth.js        — password hashing + session tokens
  lib/http-helpers.js — routing + JSON helpers
  routes/auth.js     — register + login
  routes/wallet.js   — balance, transactions, profile, games list
  routes/admin.js    — manage users/coins/games
  public/index.html  — the full frontend (login, wallet, lobby, admin)
  data/wallet.db     — SQLite database (auto-created on first run)

HOW TO DEPLOY ON RENDER:
  1. Upload this folder to a GitHub repo
  2. Create a new "Web Service" on render.com
  3. Set Build Command: (leave empty)
  4. Set Start Command: node server.js
  5. Done!

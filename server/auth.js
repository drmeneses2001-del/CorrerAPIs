const bcrypt = require('bcryptjs');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'No autenticado' });
}

async function login(req, res) {
  const { password } = req.body || {};
  const hash = process.env.APP_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ error: 'El servidor no tiene configurada APP_PASSWORD_HASH' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Falta la contraseña' });
  }
  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
  req.session.authenticated = true;
  res.json({ ok: true });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
}

function status(req, res) {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
}

module.exports = { requireAuth, login, logout, status };

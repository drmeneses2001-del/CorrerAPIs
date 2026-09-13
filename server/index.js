require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const auth = require('./auth');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('[aviso] SESSION_SECRET no definido, usando uno temporal (se invalidan sesiones al reiniciar).');
}

// Render termina HTTPS en su proxy y reenvia por HTTP interno; esto permite
// que la cookie "secure" y la deteccion de HTTPS funcionen bien.
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 12, // 12 horas
    },
  })
);

app.get('/healthz', (req, res) => res.status(200).send('ok'));

// --- Auth ---
app.post('/api/login', auth.login);
app.post('/api/logout', auth.logout);
app.get('/api/session', auth.status);

// --- Conexiones (CRUD) — la API key nunca sale en texto plano ---
app.get('/api/connections', auth.requireAuth, async (req, res) => {
  try {
    res.json(await store.listConnections());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/connections', auth.requireAuth, async (req, res) => {
  const { name, baseUrl } = req.body || {};
  if (!name || !baseUrl) {
    return res.status(400).json({ error: 'name y baseUrl son obligatorios' });
  }
  try {
    const conn = await store.createConnection(req.body);
    res.status(201).json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/connections/:id', auth.requireAuth, async (req, res) => {
  try {
    const updated = await store.updateConnection(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Conexion no encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/connections/:id', auth.requireAuth, async (req, res) => {
  try {
    const ok = await store.deleteConnection(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Conexion no encontrada' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Ejecutar una llamada contra la API real, inyectando la key solo en el servidor ---
app.post('/api/run/:id', auth.requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await store.getConnectionRaw(req.params.id);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  const { path: pathOverride, body, injectModel = true } = req.body || {};
  const relativePath = pathOverride != null ? pathOverride : conn.path || '';
  const method = (conn.method || 'POST').toUpperCase();

  let url;
  try {
    url = new URL(relativePath || '', conn.baseUrl.endsWith('/') ? conn.baseUrl : conn.baseUrl + '/');
  } catch (err) {
    return res.status(400).json({ error: 'URL resultante invalida: ' + err.message });
  }

  const headers = { 'Content-Type': 'application/json' };
  const apiKey = store.getDecryptedApiKey(conn);
  if (apiKey) {
    const headerName = conn.authHeader || 'Authorization';
    const scheme = conn.authScheme != null ? conn.authScheme : 'Bearer ';
    headers[headerName] = `${scheme}${apiKey}`;
  }

  let payload;
  if (method !== 'GET' && method !== 'HEAD') {
    payload = body && typeof body === 'object' ? { ...body } : {};
    if (injectModel && conn.model && payload.model === undefined) {
      payload.model = conn.model;
    }
  }

  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });

    const contentType = upstream.headers.get('content-type') || '';
    const text = await upstream.text();
    let data = text;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch {
        // dejar como texto si no parsea
      }
    }

    res.status(upstream.status).json({
      status: upstream.status,
      ok: upstream.ok,
      data,
    });
  } catch (err) {
    res.status(502).json({ error: 'Error llamando a la API destino: ' + err.message });
  }
});

// --- Frontend estatico ---
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`CorrerAPIs escuchando en http://localhost:${PORT}`);
});

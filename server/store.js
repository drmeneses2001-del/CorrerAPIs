const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encrypt, decrypt, maskSecret } = require('./crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'connections.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw || '[]');
}

function writeAll(list) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// Forma pública (nunca incluye la API key en texto plano)
function toPublic(conn) {
  return {
    id: conn.id,
    name: conn.name,
    baseUrl: conn.baseUrl,
    path: conn.path || '',
    method: conn.method || 'POST',
    model: conn.model || '',
    authHeader: conn.authHeader || 'Authorization',
    authScheme: conn.authScheme != null ? conn.authScheme : 'Bearer ',
    apiKeyMasked: conn.apiKeyEnc ? maskSecret(decrypt(conn.apiKeyEnc)) : null,
    hasApiKey: Boolean(conn.apiKeyEnc),
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

function listConnections() {
  return readAll().map(toPublic);
}

function getConnectionRaw(id) {
  return readAll().find((c) => c.id === id) || null;
}

function createConnection(data) {
  const list = readAll();
  const now = new Date().toISOString();
  const conn = {
    id: crypto.randomUUID(),
    name: data.name,
    baseUrl: data.baseUrl,
    path: data.path || '',
    method: (data.method || 'POST').toUpperCase(),
    model: data.model || '',
    authHeader: data.authHeader || 'Authorization',
    authScheme: data.authScheme != null ? data.authScheme : 'Bearer ',
    apiKeyEnc: data.apiKey ? encrypt(data.apiKey) : null,
    createdAt: now,
    updatedAt: now,
  };
  list.push(conn);
  writeAll(list);
  return toPublic(conn);
}

function updateConnection(id, data) {
  const list = readAll();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = list[idx];
  const updated = {
    ...existing,
    name: data.name != null ? data.name : existing.name,
    baseUrl: data.baseUrl != null ? data.baseUrl : existing.baseUrl,
    path: data.path != null ? data.path : existing.path,
    method: data.method != null ? String(data.method).toUpperCase() : existing.method,
    model: data.model != null ? data.model : existing.model,
    authHeader: data.authHeader != null ? data.authHeader : existing.authHeader,
    authScheme: data.authScheme != null ? data.authScheme : existing.authScheme,
    apiKeyEnc: data.apiKey ? encrypt(data.apiKey) : existing.apiKeyEnc,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  writeAll(list);
  return toPublic(updated);
}

function deleteConnection(id) {
  const list = readAll();
  const next = list.filter((c) => c.id !== id);
  const changed = next.length !== list.length;
  if (changed) writeAll(next);
  return changed;
}

function getDecryptedApiKey(conn) {
  if (!conn.apiKeyEnc) return null;
  return decrypt(conn.apiKeyEnc);
}

module.exports = {
  listConnections,
  getConnectionRaw,
  createConnection,
  updateConnection,
  deleteConnection,
  getDecryptedApiKey,
};

const crypto = require('crypto');
const { encrypt, decrypt, maskSecret } = require('./crypto');

const REDIS_KEY = 'correrapis:connections';

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Faltan UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN en el entorno (ver README).'
    );
  }
  return { url, token };
}

// Habla directo con la API REST de Upstash (sin SDK, sin binarios nativos):
// https://upstash.com/docs/redis/features/restapi
async function redisCommand(command) {
  const { url, token } = redisConfig();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash respondio HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error('Upstash: ' + data.error);
  return data.result;
}

async function readAll() {
  const raw = await redisCommand(['GET', REDIS_KEY]);
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(list) {
  await redisCommand(['SET', REDIS_KEY, JSON.stringify(list)]);
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

async function listConnections() {
  const list = await readAll();
  return list.map(toPublic);
}

async function getConnectionRaw(id) {
  const list = await readAll();
  return list.find((c) => c.id === id) || null;
}

async function createConnection(data) {
  const list = await readAll();
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
  await writeAll(list);
  return toPublic(conn);
}

async function updateConnection(id, data) {
  const list = await readAll();
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
  await writeAll(list);
  return toPublic(updated);
}

async function deleteConnection(id) {
  const list = await readAll();
  const next = list.filter((c) => c.id !== id);
  const changed = next.length !== list.length;
  if (changed) await writeAll(next);
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

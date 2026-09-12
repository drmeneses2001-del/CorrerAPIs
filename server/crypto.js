const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'Falta ENCRYPTION_KEY en el entorno. Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser 32 bytes codificados en base64.');
  }
  return key;
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = String(payload).split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function maskSecret(plainText) {
  const s = String(plainText || '');
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

module.exports = { encrypt, decrypt, maskSecret };

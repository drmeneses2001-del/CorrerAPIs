# CorrerAPIs

App web para definir y "correr" varias APIs (por ejemplo endpoints tipo GPT/OpenAI,
DataStax Astra, o cualquier API REST) desde una sola pantalla — pensada para usarse
cómodamente desde un iPad Pro (Safari) agregándola a la pantalla de inicio.

Cada conexión se define con:

- **Nombre**
- **URL base** (la URL nativa de la API)
- **Path** por defecto (ej. `chat/completions`) y método HTTP
- **Modelo** (se inyecta automáticamente en el body como `"model": "..."` si no lo mandas tú)
- **Header y esquema de autenticación** (por defecto `Authorization: Bearer <key>`, pero
  configurable para APIs que usan otro header, como `x-api-key` o un token plano)
- **API key**

La API key se cifra (AES-256-GCM) antes de guardarse y **nunca se devuelve al
navegador** una vez guardada (solo se muestran los últimos 4 caracteres, ej.
`••••1234`). Al "correr" una llamada, el navegador solo manda el body/prompt;
el servidor arma la petición real con la key inyectada y reenvía la respuesta
de vuelta.

Las conexiones (ya cifradas) se guardan en **Upstash Redis** en vez de en un
archivo local — así sobreviven a los reinicios/redeploys de hosts gratuitos
como Render, cuyo disco local se borra en cada uno.

## Configuración inicial

```bash
npm install
cp .env.example .env
```

Genera y coloca en `.env`:

```bash
# Hash de la contraseña de acceso a la app
node -e "console.log(require('bcryptjs').hashSync('TU_CONTRASENA', 10))"

# Clave de cifrado para las API keys guardadas
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Secreto de sesión (cualquier cadena larga aleatoria)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Pon esos valores en `APP_PASSWORD_HASH`, `ENCRYPTION_KEY` y `SESSION_SECRET` de `.env`,
y crea una base gratis en [console.upstash.com](https://console.upstash.com) para
sacar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (pestaña "REST API"
de tu base).

## Arrancar

```bash
npm start
```

Por defecto queda en `http://localhost:3000`.

Si vas a exponerla fuera de `localhost` (por ejemplo en tu red local o un servidor),
sírvela detrás de HTTPS y pon `COOKIE_SECURE=true` en `.env`.

## Desplegar gratis, sin tarjeta (Render + Upstash)

GitHub por si solo no puede correr esta app (GitHub Pages solo sirve archivos
estaticos; CorrerAPIs necesita un servidor Node vivo). La combinacion que no
pide tarjeta y no tiene costo:

- **[Render](https://render.com)** hospeda el servidor Node, conectado a este
  repo de GitHub (deploy automatico en cada push). Su capa gratis "duerme" el
  servicio tras 15 min sin trafico y tarda ~1 min en despertar en la siguiente
  visita — normal para uso personal.
- **[Upstash](https://console.upstash.com)** guarda las conexiones (cifradas)
  en una base Redis gratis que nunca se borra, para que sobrevivan a que Render
  reinicie el servicio.

Pasos:

1. **Crear la base en Upstash**: [console.upstash.com](https://console.upstash.com)
   → sign up (con GitHub o email, sin tarjeta) → **Create Database** → cualquier
   nombre y region → dentro de la base, pestaña **REST API**, copia
   `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
2. **Crear el servicio en Render**: [render.com](https://render.com) → sign up
   con GitHub → **New → Web Service** → selecciona el repo `CorrerAPIs` y la
   rama `claude/ipad-api-runner-app-o5tpgd`. Render detecta Node solo
   (`npm install` / `npm start`).
3. En **Environment**, agrega las variables:
   - `APP_PASSWORD_HASH`
   - `ENCRYPTION_KEY`
   - `SESSION_SECRET`
   - `COOKIE_SECURE=true`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. **Create Web Service** y espera el primer deploy (unos minutos). Render te
   da una URL propia en HTTPS (`tu-app.onrender.com`) — esa es la que abres en
   Safari en el iPad Pro y agregas a la pantalla de inicio.

Cada push a esa rama vuelve a desplegar solo.

## Usarla desde el iPad Pro

1. Abre la URL del servidor en Safari.
2. Toca **Compartir → Agregar a pantalla de inicio**. Queda como app instalada
   (icono propio, pantalla completa, sin barra de Safari).
3. Inicia sesión con la contraseña configurada y empieza a agregar conexiones.

## Ejemplo: conexión tipo OpenAI/GPT

- URL base: `https://api.openai.com/v1/`
- Path: `chat/completions`
- Método: `POST`
- Header: `Authorization` / Esquema: `Bearer `
- Modelo: `gpt-4o`
- Body al correr:
  ```json
  { "messages": [{ "role": "user", "content": "Hola" }] }
  ```

## Ejemplo: conexión tipo Astra (DataStax)

Ajusta URL base, path y el header de autenticación según el producto de Astra que
uses (Data API, Vectorize, o un gateway compatible con OpenAI) — por ejemplo, si el
servicio requiere un token plano en vez de `Bearer`, deja el "Prefijo del header"
vacío y pon el nombre real del header (`X-Cassandra-Token`, `AstraCS`, etc.) en
"Header de autenticación".

## Seguridad

- Toda la app queda detrás de login (contraseña única, sesión con cookie httpOnly).
- Las API keys se cifran en reposo (AES-256-GCM) antes de guardarse en Upstash,
  y nunca se sirven de vuelta al cliente.
- El archivo `.env` (con `ENCRYPTION_KEY`, tokens de Upstash, etc.) está en
  `.gitignore`: no se sube al repositorio.
- Si compartes o despliegas esto en un servidor accesible desde internet, usa
  siempre HTTPS.

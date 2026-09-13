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

La API key se cifra (AES-256-GCM) antes de guardarse en `data/connections.json` y
**nunca se devuelve al navegador** una vez guardada (solo se muestran los últimos 4
caracteres, ej. `••••1234`). Al "correr" una llamada, el navegador solo manda el
body/prompt; el servidor arma la petición real con la key inyectada y reenvía la
respuesta de vuelta.

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

Pon esos valores en `APP_PASSWORD_HASH`, `ENCRYPTION_KEY` y `SESSION_SECRET` de `.env`.

## Arrancar

```bash
npm start
```

Por defecto queda en `http://localhost:3000`.

Si vas a exponerla fuera de `localhost` (por ejemplo en tu red local o un servidor),
sírvela detrás de HTTPS y pon `COOKIE_SECURE=true` en `.env`.

## Desplegar en Railway (recomendado)

GitHub por si solo no puede correr esta app (GitHub Pages solo sirve archivos
estaticos; CorrerAPIs necesita un servidor Node vivo). Railway se conecta a tu
repo de GitHub y hace deploy automatico en cada push, y sus planes incluyen
**volumenes persistentes** — importante aqui porque `data/connections.json`
(tus API keys cifradas) debe sobrevivir a cada redeploy.

1. Sube el proyecto a GitHub (ya esta en la rama `claude/ipad-api-runner-app-o5tpgd`
   de este repo).
2. En [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**
   y selecciona este repositorio y esa rama. Railway detecta que es Node y usa
   `npm start` automaticamente (ya viene configurado en `railway.json`).
3. En la pestaña **Variables** del servicio agrega:
   - `APP_PASSWORD_HASH`
   - `ENCRYPTION_KEY`
   - `SESSION_SECRET`
   - `COOKIE_SECURE=true`
   - `DATA_DIR=/data`

   (genera los dos primeros con los comandos de "Configuración inicial" arriba).
4. Agrega un **Volume** al servicio (pestaña **Volumes**) con mount path `/data`.
   Esto hace que `data/connections.json` no se borre en cada deploy.
5. Railway te da un dominio propio en HTTPS (`algo.up.railway.app`). Ese es el
   link que abres en Safari en el iPad Pro y agregas a la pantalla de inicio.

Cada vez que hagas push a la rama conectada, Railway vuelve a desplegar solo.

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
- Las API keys se cifran en reposo y nunca se sirven de vuelta al cliente.
- El archivo `data/connections.json` (con las keys cifradas) y `.env` están en
  `.gitignore`: no se suben al repositorio.
- Si compartes o despliegas esto en un servidor accesible desde internet, usa
  siempre HTTPS.

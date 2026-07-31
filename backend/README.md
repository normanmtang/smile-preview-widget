# Smile Preview Backend

Node.js/Express API that receives a selfie, sends it to the OpenAI
Images API for a cosmetic smile-enhancement edit, and returns the
result. Nothing is written to disk — uploads live in memory only for
the duration of a single request.

## Requirements

- Node.js 18 or newer
- An OpenAI API key with access to image generation/editing
  (`gpt-image-1`)

## Local setup

```bash
cd backend
cp .env.example .env
# edit .env and set OPENAI_API_KEY and ALLOWED_ORIGINS
npm install
npm run dev      # nodemon, restarts on change
# or: npm start
```

The server listens on `http://localhost:3000` by default (`PORT` in
`.env`). Confirm it's up:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

To test `/generate` from the command line:

```bash
curl -X POST http://localhost:3000/generate \
  -F "image=@/path/to/selfie.jpg" \
  -F "consent=true"
```

When testing locally, add `http://localhost:3000` — or wherever your
static test page is served from — to `ALLOWED_ORIGINS` in `.env`, or
requests from a browser will be blocked by CORS. `curl` calls (which
send no `Origin` header) work regardless.

## API reference

### `GET /health`

Liveness check. Returns `200 { "status": "ok" }`. Useful for uptime
monitors and Render's health check.

### `POST /generate`

`multipart/form-data` body:

| field     | type   | required | notes                                   |
|-----------|--------|----------|------------------------------------------|
| `image`   | file   | yes      | JPEG/PNG/WEBP, ≤ `MAX_UPLOAD_MB` (default 8MB) |
| `consent` | string | yes      | must be the literal string `"true"`     |

Success — `200`:

```json
{ "image": "data:image/png;base64,iVBORw0KGgo..." }
```

Failure — `4xx`/`5xx`, always this shape:

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human-readable explanation." }
```

Notable error codes: `CONSENT_REQUIRED`, `NO_FILE`,
`UNSUPPORTED_FILE_TYPE`, `INVALID_IMAGE_CONTENT`, `FILE_TOO_LARGE`,
`IMAGE_REJECTED`, `RATE_LIMITED`, `UPSTREAM_RATE_LIMITED`,
`ORIGIN_NOT_ALLOWED`, `INTERNAL_ERROR`.

## Environment variables

See `.env.example` for the full list with descriptions. The two that
matter most:

- `OPENAI_API_KEY` — required, never expose this anywhere client-side.
- `ALLOWED_ORIGINS` — required in production; comma-separated list of
  the exact origins allowed to call this API (your Squarespace
  domain(s)).

## How privacy/security requirements are met in code

- **No permanent storage:** `multer` is configured with
  `memoryStorage()` (`middleware/upload.js`) — the upload never
  touches disk. It exists only as a `Buffer` for the duration of the
  request and is garbage collected afterward.
- **EXIF/GPS stripped:** `routes/generate.js` re-encodes every image
  with `sharp` before it's sent anywhere, which drops EXIF metadata
  (including GPS tags many phone photos carry).
- **File validation:** MIME allow-list in `fileFilter`, size limit in
  `multer.limits`, and a second check via magic-byte sniffing
  (`file-type`) so a renamed non-image file is rejected even if its
  declared `Content-Type` looks fine.
- **Rate limiting:** `express-rate-limit` on `/generate` specifically
  (`middleware/rateLimiter.js`), tunable via env vars.
- **CORS:** only origins in `ALLOWED_ORIGINS` are permitted
  (`server.js`).
- **Security headers:** `helmet`, including a locked-down CSP (this
  API serves JSON only, no HTML).
- **Input sanitization:** filenames are sanitized before ever being
  logged (`utils/sanitize.js`); consent is re-checked server-side
  regardless of what the client sent.
- **Server-side consent check:** the client blocks submission without
  a checked consent box, but the server independently rejects any
  request where `consent !== "true"`.

## Production deployment

See `../DEPLOYMENT.md` for step-by-step Render instructions.

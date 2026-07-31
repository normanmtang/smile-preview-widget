'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');

const generateRouter = require('./routes/generate');

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy that
// terminates TLS. Trusting the proxy lets express-rate-limit and
// req.ip see the real client IP instead of the proxy's.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------
app.use(
  helmet({
    // This API returns JSON/base64 image data, not HTML pages, so a
    // strict default CSP has no meaningful downside here.
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ---------------------------------------------------------------------
// CORS — only the configured Squarespace origin(s) may call this API.
// ---------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    '[startup] WARNING: ALLOWED_ORIGINS is not set. No browser origin will be able to call this API. ' +
      'Set ALLOWED_ORIGINS in your environment before going to production.'
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server calls (no Origin header),
      // e.g. health checks and curl, but not arbitrary browser origins.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS_NOT_ALLOWED'));
    },
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/', generateRouter);

// ---------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------

// Multer raises errors (e.g. file too large) as middleware errors
// rather than inside the route handler, so they need their own catch.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: `Please upload an image smaller than ${process.env.MAX_UPLOAD_MB || 8}MB.`,
      });
    }
    return res.status(400).json({ error: 'UPLOAD_ERROR', message: 'The file could not be uploaded.' });
  }

  if (err?.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not permitted to use this API.' });
  }

  if (err?.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ error: 'UNSUPPORTED_FILE_TYPE', message: 'Please upload a JPEG, PNG, or WEBP image.' });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'This endpoint does not exist.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Smile Preview backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;

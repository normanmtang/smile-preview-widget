'use strict';

const rateLimit = require('express-rate-limit');

const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15;
const max = Number(process.env.RATE_LIMIT_MAX) || 5;

/**
 * Image generation calls cost real money and hit a third-party API,
 * so /generate gets a tighter limit than the rest of the app.
 * Adjust RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MIN via env vars per
 * expected traffic.
 */
const generateLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many smile previews requested from this connection. Please try again later.',
  },
});

module.exports = { generateLimiter };

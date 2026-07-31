'use strict';

/**
 * Small collection of input-sanitization helpers used across the API.
 * Keeping these in one place makes it easy to audit everything that
 * touches user-supplied data.
 */

/**
 * Strip anything from a string that isn't a plain word character,
 * space, dash, or dot. Used for things like echoing a filename back
 * in a log line — never trust a client-supplied filename otherwise.
 * @param {string} input
 * @returns {string}
 */
function sanitizeFilename(input) {
  if (typeof input !== 'string') return 'upload';
  const cleaned = input
    .normalize('NFKC')
    .replace(/[^\w.\- ]/g, '')
    .slice(0, 120)
    .trim();
  return cleaned.length > 0 ? cleaned : 'upload';
}

/**
 * Only a small, explicit allow-list of image MIME types is accepted.
 * This is intentionally narrow — we only need what selfies come in as.
 */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Matching magic-byte signatures, used to verify the file's real
 * contents rather than trusting the client-declared MIME type.
 */
const ALLOWED_FILE_TYPE_EXTENSIONS = new Set(['jpg', 'png', 'webp']);

module.exports = {
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_TYPE_EXTENSIONS,
};

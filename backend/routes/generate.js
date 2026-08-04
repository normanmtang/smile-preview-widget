'use strict';

const express = require('express');
const sharp = require('sharp');
const FileType = require('file-type');

const { upload, MAX_UPLOAD_MB } = require('../middleware/upload');
const { generateLimiter } = require('../middleware/rateLimiter');
const { ALLOWED_MIME_TYPES, ALLOWED_FILE_TYPE_EXTENSIONS, sanitizeFilename } = require('../utils/sanitize');
const { generateSmilePreview } = require('../utils/openaiClient');

const router = express.Router();

/**
 * POST /generate
 *
 * multipart/form-data body:
 *   - image: the selfie file
 *   - consent: the string "true" — a server-side backstop confirming
 *     the client's consent checkbox was checked. The UI also blocks
 *     submission without it, but we never trust the client alone.
 *
 * Response (200):
 *   { "image": "data:image/png;base64,...." }
 *
 * Response (4xx/5xx):
 *   { "error": "ERROR_CODE", "message": "human readable explanation" }
 */
router.post('/generate', generateLimiter, upload.single('image'), async (req, res) => {
  const safeName = sanitizeFilename(req.file?.originalname);

  try {
    // 1. Consent must be explicitly confirmed, server-side, regardless
    //    of what the frontend already enforced.
    if (req.body?.consent !== 'true') {
      return res.status(400).json({
        error: 'CONSENT_REQUIRED',
        message: 'Consent to AI processing is required before an image can be generated.',
      });
    }

    // 2. A file must have been attached and pass multer's MIME filter.
    if (!req.file) {
      return res.status(400).json({
        error: 'NO_FILE',
        message: 'No image was uploaded. Please choose a photo and try again.',
      });
    }

    // 3. Verify the file's real contents against its declared MIME
    //    type using magic-byte sniffing — never trust the
    //    Content-Type header or file extension alone.
    const detected = await FileType.fromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_FILE_TYPE_EXTENSIONS.has(detected.ext) || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return res.status(400).json({
        error: 'INVALID_IMAGE_CONTENT',
        message: 'The uploaded file does not appear to be a valid JPEG, PNG, or WEBP image.',
      });
    }

    // 4. Re-encode with sharp. This (a) strips EXIF/GPS metadata that
    //    phone selfies commonly embed, protecting patient privacy,
    //    (b) normalizes orientation, and (c) guards against malformed
    //    or malicious image payloads reaching the OpenAI API, since
    //    sharp will throw on data that isn't a genuinely decodable
    //    image.
    const normalized = await sharp(req.file.buffer)
      .rotate() // apply EXIF orientation, then metadata below strips EXIF
      .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    // 5. Call the OpenAI Images API for the cosmetic smile edit.
    const base64Result = await generateSmilePreview(normalized, 'image/png');

    // 6. Nothing was ever written to disk (multer used memory storage,
    //    and `normalized`/`req.file.buffer` are local variables that
    //    go out of scope here) — so there is no temp file to clean up.
    //    We still null the references defensively so the raw upload
    //    isn't retained anywhere in memory for longer than necessary.
    req.file.buffer = null;

    return res.status(200).json({
      image: `data:image/png;base64,${base64Result}`,
    });
  } catch (err) {
    return handleGenerateError(err, safeName, res);
  }
});

/**
 * Centralized error mapping so failure modes return clear, safe
 * messages without leaking internals (stack traces, API keys, etc.)
 * to the client.
 */
function handleGenerateError(err, safeName, res) {
  const message = err?.message || '';

  if (message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      error: 'UNSUPPORTED_FILE_TYPE',
      message: 'Please upload a JPEG, PNG, or WEBP image.',
    });
  }

  if (message.includes('File too large')) {
    return res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: `Please upload an image smaller than ${MAX_UPLOAD_MB}MB.`,
    });
  }

  if (message === 'EMPTY_MODEL_RESPONSE') {
    return res.status(502).json({
      error: 'GENERATION_FAILED',
      message: 'The smile preview could not be generated. Please try a different, clearer photo.',
    });
  }

  // OpenAI SDK errors carry a `status` for HTTP failures.
  if (err?.status === 400) {
    return res.status(422).json({
      error: 'IMAGE_REJECTED',
      message: 'This photo could not be processed. Try a well-lit, front-facing photo showing your smile.',
    });
  }

  if (err?.status === 401 || err?.status === 403) {
    // Server misconfiguration — do not expose details to the client.
    console.error(`[generate] Upstream auth error for upload "${safeName}":`, err);
    return res.status(500).json({
      error: 'SERVER_MISCONFIGURED',
      message: 'The smile preview service is temporarily unavailable. Please try again later.',
    });
  }

  if (err?.status === 429) {
    return res.status(503).json({
      error: 'UPSTREAM_RATE_LIMITED',
      message: 'The smile preview service is busy right now. Please try again in a minute.',
    });
  }

  console.error(`[generate] Unexpected error processing upload "${safeName}":`, err);
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Something went wrong generating your smile preview. Please try again.',
  });
}

module.exports = router;

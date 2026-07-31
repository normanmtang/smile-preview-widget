'use strict';

const OpenAI = require('openai');
const { toFile } = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

/**
 * The single source of truth for the cosmetic smile-enhancement
 * prompt. Keeping this in one place makes it easy to review,
 * version, and tune without touching route logic.
 *
 * This is a cosmetic visualization prompt only — it explicitly
 * avoids any language implying diagnosis or a guaranteed clinical
 * outcome, and it constrains the model to conservative, identity-
 * preserving edits.
 */
const SMILE_PREVIEW_PROMPT = `
Edit this photo to show a realistic, conservative cosmetic dentistry preview.
Apply only the following changes:
- Straighten the teeth naturally, as if from clear aligners or braces
- Whiten the teeth slightly — a natural, healthy shade, not bright white
- Improve dental symmetry and evenness subtly
- Keep tooth size and shape proportional to the face and mouth

Do not change anything else. Preserve exactly:
- The person's facial structure and identity
- Skin tone and texture
- Lighting and shadows in the original photo
- Hairstyle and hair color
- Apparent age
- Facial expression and head pose
- Background

Avoid an artificial, "veneers" or "Hollywood" look. The result should look
like something achievable through real cosmetic dentistry (whitening,
clear aligners, or minor bonding) — subtle, natural, and true to the
original photo. This is a cosmetic visualization only, not a medical or
diagnostic image.
`.trim();

/**
 * Sends the uploaded selfie to the OpenAI Images API for an
 * identity-preserving cosmetic smile edit.
 *
 * @param {Buffer} imageBuffer - Raw bytes of the validated upload.
 * @param {string} mimeType - Validated MIME type, e.g. "image/jpeg".
 * @returns {Promise<string>} A base64-encoded PNG of the result.
 */
async function generateSmilePreview(imageBuffer, mimeType) {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

  const file = await toFile(imageBuffer, `selfie.${extension}`, { type: mimeType });

  const response = await client.images.edit({
    model: MODEL,
    image: file,
    prompt: SMILE_PREVIEW_PROMPT,
    size: '1024x1024',
    quality: 'high',
  });

  const result = response?.data?.[0];
  if (!result?.b64_json) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }

  return result.b64_json;
}

module.exports = { generateSmilePreview, SMILE_PREVIEW_PROMPT };

# AI Smile Preview Widget

A production-ready "AI Smile Preview" tool for dental practice websites.
Patients upload a selfie, confirm consent, and receive an AI-generated
cosmetic visualization of a straighter, slightly whiter smile — shown
in a before/after comparison slider, downloadable as an image.

**This is a cosmetic visualization tool, not a diagnostic or medical
device.** Every surface of the widget (consent copy, result screen,
disclaimer) says so explicitly, and the AI prompt is written to
produce conservative, realistic previews rather than idealized ones.

## How it's split up

Squarespace only lets you embed static HTML/CSS/JS (via a Code
Block) — it cannot run server-side code or call the OpenAI API
directly with a secret key. So this project has two halves:

```
smile-preview-widget/
├── backend/          Node.js/Express API — deploy this to Render (or
│                      any Node host). Holds your OpenAI API key and
│                      talks to the OpenAI Images API.
│   ├── server.js
│   ├── routes/generate.js
│   ├── middleware/upload.js       (file validation, memory storage)
│   ├── middleware/rateLimiter.js
│   ├── utils/openaiClient.js      (the smile-enhancement prompt lives here)
│   ├── utils/sanitize.js
│   ├── package.json
│   └── .env.example
│
├── frontend/          The embeddable widget — paste into Squarespace.
│   ├── embed.html      ← the file you actually paste into Squarespace
│   ├── widget.html      (same markup, unbundled)
│   ├── widget.css        (same styles, unbundled)
│   └── widget.js          (same script, unbundled)
│
├── DEPLOYMENT.md       Backend deployment guide (Render)
├── SQUARESPACE.md      Squarespace installation guide
└── README.md           This file
```

`frontend/embed.html` is the single self-contained file to paste into
a Squarespace Code Block — it has the CSS and JS inlined so there's
only one thing to copy. `widget.html` / `widget.css` / `widget.js`
are the same code split into separate files, kept for readability,
version control, and in case you'd rather host the CSS/JS externally
and reference them with `<link>`/`<script src>` tags instead.

## How it works

1. **Upload** — the visitor drags a photo in, or picks one via the
   file input. The widget validates type/size client-side and shows
   a preview.
2. **Consent** — a required checkbox confirms the visitor understands
   their photo will be processed by AI, that this is a visualization
   only, and that the photo isn't stored permanently.
3. **Generate** — the widget POSTs the photo to your backend's
   `/generate` endpoint as `multipart/form-data`.
4. **Backend processing** — the backend:
   - Re-validates file type (via magic-byte sniffing, not just the
     declared MIME type) and size
   - Strips EXIF/GPS metadata and normalizes the image with `sharp`
   - Sends it to the OpenAI Images API (`gpt-image-1`, image edit)
     with a fixed, reviewed cosmetic-enhancement prompt
   - Returns the result as a base64 data URL
   - Never writes the upload to disk (multer uses in-memory storage),
     so there is no temp file to clean up — it's discarded when the
     request ends
5. **Result** — the widget shows a before/after comparison slider and
   a download button, plus the same disclaimer language again.

## AI prompt

The prompt sent to the OpenAI Images API lives in one place:
`backend/utils/openaiClient.js` (`SMILE_PREVIEW_PROMPT`). It instructs
the model to:

- Straighten teeth naturally and improve symmetry
- Whiten slightly (not bright white)
- Preserve facial structure, skin tone, lighting, hairstyle, age, and
  expression
- Avoid an artificial "Hollywood veneers" look
- Produce something realistically achievable through cosmetic
  dentistry

Review and tune this prompt with your practice's clinical and
marketing standards before going live — see the "Content review"
note in `DEPLOYMENT.md`.

## Quick start

1. Deploy the backend — see `DEPLOYMENT.md`.
2. Set `window.SMILE_API_BASE_URL` in `frontend/embed.html` to your
   deployed backend URL.
3. Paste `frontend/embed.html` into a Squarespace Code Block — see
   `SQUARESPACE.md`.

## Tech stack

- **Backend:** Node.js, Express, Multer (in-memory uploads), Sharp
  (image normalization/EXIF stripping), `file-type` (magic-byte
  validation), `express-rate-limit`, Helmet, the official `openai`
  SDK.
- **Frontend:** No framework — plain HTML/CSS/JS so it can be pasted
  directly into a Squarespace Code Block with no build step.

## Important disclaimers to keep in your copy

Do not remove or water down the disclaimer language in the widget or
this documentation. Cosmetic AI previews sit close to health claims —
keep language limited to "visualization," "preview," and "cosmetic,"
and keep the "not a diagnosis / consult a licensed professional"
language visible on both the consent step and the result screen.

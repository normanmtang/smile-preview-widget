# Deployment Guide — Render

This guide deploys `backend/` to [Render](https://render.com) as a
Web Service. Render gives you HTTPS automatically, so the API is
HTTPS-ready with no extra configuration on your part.

## 1. Push the backend to a Git repository

Render deploys from GitHub, GitLab, or Bitbucket. Commit the
`backend/` folder (and ideally the whole `smile-preview-widget/`
project) to a repository. **Do not commit your real `.env` file** —
only `.env.example` should be tracked.

## 2. Create the Web Service

1. In the Render dashboard: **New > Web Service**.
2. Connect your repository.
3. Configure:
   - **Root Directory:** `backend` (if the repo contains more than
     just the backend)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Starter is fine to begin with; scale up if
     you see cold-start latency you don't like (OpenAI image
     generation itself takes 15–30s regardless of instance size).

## 3. Set environment variables

In the service's **Environment** tab, add:

| Key | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI secret key (from platform.openai.com) |
| `ALLOWED_ORIGINS` | Your live Squarespace domain(s), comma-separated, no trailing slash — e.g. `https://www.yourpractice.com,https://yourpractice.com` |
| `NODE_ENV` | `production` |
| `MAX_UPLOAD_MB` | `8` (or your preferred limit) |
| `RATE_LIMIT_MAX` | `5` |
| `RATE_LIMIT_WINDOW_MIN` | `15` |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` |

Do **not** set `PORT` — Render injects it automatically and the app
already reads `process.env.PORT`.

Click **Save Changes**, then deploy (Render deploys automatically on
push once connected; you can also trigger a manual deploy).

## 4. Get your API key from OpenAI

1. Sign in at [platform.openai.com](https://platform.openai.com).
2. Go to **API keys** and create a new secret key.
3. Confirm your account has billing set up and access to image
   generation (`gpt-image-1`) — image editing is a paid, metered
   endpoint.
4. Paste the key into Render's `OPENAI_API_KEY` variable (step 3
   above). Never put this key in frontend code, a Squarespace Code
   Block, or a public repo.

## 5. Verify the deployment

Once deployed, Render gives you a URL like
`https://smile-preview-backend.onrender.com`. Check:

```bash
curl https://smile-preview-backend.onrender.com/health
# {"status":"ok"}
```

Then test `/generate` with a real image the same way as in local
testing (see `backend/README.md`), substituting your Render URL.

## 6. Point the widget at your backend

In `frontend/embed.html`, update:

```html
<script>window.SMILE_API_BASE_URL = 'https://smile-preview-backend.onrender.com';</script>
```

Then follow `SQUARESPACE.md` to paste the updated file into your
site.

## Running locally

```bash
cd backend
cp .env.example .env
# fill in OPENAI_API_KEY; set ALLOWED_ORIGINS to include wherever
# you're testing the frontend from (e.g. http://localhost:5500 if
# you're serving frontend/embed.html with a local static server)
npm install
npm run dev
```

## Notes on scaling and cost

- Each `/generate` call is one OpenAI image-edit request — this is
  the dominant cost driver. `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MIN`
  are your main lever for capping spend from abusive traffic.
- Render's free/starter tiers spin down on inactivity, which adds a
  cold-start delay to the first request after idle time. If that
  matters for your traffic pattern, use a plan that stays warm, or
  add an external uptime ping to `/health` every few minutes.
- The service is stateless (no database, no disk persistence), so it
  scales horizontally without any special configuration if you need
  more than one instance.

## Content review before going live

The AI prompt (`backend/utils/openaiClient.js`) and all
patient-facing copy (consent text, disclaimers) should be reviewed by
whoever owns clinical/marketing compliance for your practice before
this goes live on a real domain. Cosmetic-outcome visualizations are
an area regulators and dental boards pay attention to — keep the
"visualization only, not a diagnosis or guarantee" language intact
and prominent.

# Squarespace Installation Guide

This adds the Smile Preview widget to any Squarespace page using a
**Code Block**. No Squarespace plugin or Developer Mode is required.

## Prerequisites

- Your backend is already deployed and reachable over HTTPS (see
  `DEPLOYMENT.md`). You'll need its URL, e.g.
  `https://smile-preview-backend.onrender.com`.
- Your Squarespace plan supports Code Blocks — this is available on
  all current Squarespace plans (Code Blocks are a standard content
  block, not a Developer Platform feature).

## Step 1 — Configure the embed file

Open `frontend/embed.html` and edit this line near the top:

```html
<script>window.SMILE_API_BASE_URL = 'https://your-backend.onrender.com';</script>
```

Replace the URL with your actual backend URL from `DEPLOYMENT.md`.
Use `https://`, no trailing slash.

## Step 2 — Add a Code Block in Squarespace

1. Edit the page where the widget should appear.
2. Click an insert point (**+**) and choose **Code** from the block
   menu (it's under "More" in some Squarespace versions).
3. In the code editor that opens, make sure the format is set to
   **HTML** (this is the default for a Code Block).
4. Paste the **entire contents** of `frontend/embed.html` into the
   block.
5. Click outside the block (or **Apply**/**Save**) to render it.
6. Save and preview the page.

That's it — the Code Block's HTML editor accepts `<style>` and
`<script>` tags directly, which is why `embed.html` bundles
everything into one paste.

## Step 3 — Test end to end

On the live (or preview) page:

1. Upload a test photo.
2. Check the consent box.
3. Click **Generate Smile Preview** and confirm it completes and
   shows the before/after slider.
4. Drag the slider, then click **Download image** and confirm a file
   downloads.
5. Open your browser's dev tools **Network** tab and confirm the
   `/generate` request goes to your backend URL and returns `200`.

If the request fails with a CORS error in the console, double-check
that `ALLOWED_ORIGINS` on the backend (Render environment variables)
exactly matches the origin your Squarespace site is served from,
including `https://` and both `www` and non-`www` variants if your
site answers on both.

## Placement tips

- The widget is self-contained and responsive; it works in a
  full-width Code Block or inside a narrower column layout.
- For a dedicated landing page, put the Code Block inside a Section
  with generous top/bottom padding so the card has room to breathe.
- Avoid placing more than one instance of the widget on the same
  page — it uses a single fixed element ID
  (`smile-preview-widget`) and is only designed to run once per page.

## Updating the widget later

Because everything lives in one pasted block, updates are a matter
of editing `frontend/embed.html` in your codebase, then replacing the
Code Block's contents on the live page with the new version. Keep
`frontend/embed.html` in version control so you have a history of
what copy/design has shipped.

## Custom domain / CORS reminder

Every domain and subdomain that will host this widget must be listed
in the backend's `ALLOWED_ORIGINS` environment variable on Render.
If you later add the widget to a staging site or a second domain,
update `ALLOWED_ORIGINS` and redeploy the backend — the widget itself
doesn't need to change.

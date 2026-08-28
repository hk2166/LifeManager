# Google Cloud setup (T-03) — manual, ~15 min

One person does this once, against the **demo Gmail account** (never a personal inbox).

1. Create the demo Google account (plain gmail.com signup), e.g. `lifeos.demo.2026@gmail.com`.
2. Go to https://console.cloud.google.com → new project → name `life-os-demo`.
3. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
4. **APIs & Services → OAuth consent screen**:
   - User type **External**, publishing status stays **Testing**.
   - App name `Life OS`; support + developer email = your own.
   - Scopes: none needed here (requested at runtime).
   - **Test users**: add the demo Gmail address. Without this, login fails.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type **Web application**, name `life-os-api`.
   - Authorized redirect URI: `http://localhost:3001/oauth2callback`.
6. Copy client ID + secret into `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
7. With the API running (`npm run dev`), open http://localhost:3001/auth/google and sign in **as the demo account**. You'll hit a "Google hasn't verified this app" screen — Advanced → continue. That's expected in Testing mode.

## Gotchas (from TASKS.md R5)

- **Testing-mode refresh tokens expire after 7 days.** Re-run the consent flow the evening before the demo so the clock is fresh.
- Never do the OAuth dance on stage — the unverified-app screen looks terrible. The account is connected before the demo starts.
- Scopes are read-only (`gmail.readonly`, `calendar.readonly`); we never write to Google.

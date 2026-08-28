# Life OS — Local Setup

Get the whole thing running locally: Postgres, the API, the web dashboard, and (optionally) the mobile app.

## 1. Prerequisites

- **Node.js 20+** — `node -v` should print v20 or higher ([nodejs.org](https://nodejs.org))
- **Docker Desktop** — runs Postgres; make sure it's **running** before step 4 ([download](https://www.docker.com/products/docker-desktop))
- **git**
- *(mobile, Mac only)* **Xcode** from the App Store

You'll also need two **API keys** — ask the team lead for a ready-made `.env`, or bring your own:

- **Anthropic** — commitment extraction + memo classification ([console.anthropic.com](https://console.anthropic.com))
- **OpenAI** — Whisper transcription + embeddings ([platform.openai.com](https://platform.openai.com))

> **Google is optional.** Leave the `GOOGLE_*` vars blank — the app runs fully on the built-in demo inbox. You only need Google to ingest a *real* Gmail account (see [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)).

## 2. Clone & install

```bash
git clone https://github.com/hk2166/LifeManager.git
cd LifeManager
npm install
```

This is an npm-workspaces monorepo — one `npm install` at the root wires up `apps/api`, `apps/web`, `apps/mobile`, and `packages/shared`.

## 3. Configure `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in the two keys (everything else has working defaults):

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

`.env` is gitignored on purpose — never commit it. The easiest route is to get a filled-in `.env` from the team lead privately.

## 4. Start the database, backend, and dashboard

```bash
docker compose up -d      # Postgres + pgvector on :5432
npm run demo:reset        # migrate + seed + extract + embed + anticipate (uses your keys, ~1 min)
npm run dev               # API on :3001, dashboard on :5173
```

Open **http://localhost:5173**, then **create an account** (or use the demo login `hemant.k@adypu.edu.in` / `demodemo` that `db:reset` creates). Every account gets its own private copy of the demo corpus. You should see the dashboard populated with ~6 commitments, 5 waiting-on, and a "Coming up" list. ✅

> The app is now multi-user: each account's data is fully isolated. `JWT_SECRET` in `.env` signs login tokens — any long random string works locally.

> No API keys yet? Run `npm run db:reset` instead of `demo:reset` — you'll get the dashboard shell and seeded emails, but no AI-extracted items until you add keys and run `npm run demo:reset`.

## 5. Mobile app (optional)

### Easy path — Expo Go, no Xcode

```bash
npm run start -w mobile
```

Install **Expo Go** from the App Store and scan the QR code. So the phone can reach the API on your machine, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP — create `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001
```

(Find your IP with `ipconfig getifaddr en0` on macOS.)

### Full native path — iOS Simulator (Mac)

```bash
cd apps/mobile
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios
```

The app uses native modules (audio, blur, safe-area), so the first run builds a dev client — give it a few minutes.

## 6. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | API (:3001) + dashboard (:5173) |
| `npm run demo:reset` | Wipe → migrate → seed → extract → embed → anticipate |
| `npm run db:reset` | Just wipe → migrate → seed (no AI) |
| `npm run extract` | Re-run commitment extraction |
| `npm run eval:extraction` | Extraction precision/recall (~91%/91%) |
| `npm run eval:memos` | Memo classification accuracy (~93%) |
| `npm run typecheck` | Typecheck api + web |
| `npm run start -w mobile` | Expo dev server for the mobile app |

## 7. Troubleshooting

- **Dashboard says "can't reach the API":** Docker Desktop must be running, and nothing else can be on ports **3001 / 5173**.
- **Simulator won't boot / "no iOS runtime":** install a runtime with `xcodebuild -downloadPlatform iOS` (~7 GB) or via **Xcode → Settings → Platforms**.
- **Simulator build fails on CocoaPods** (common with Ruby 4.x): `brew reinstall cocoapods`, then always prefix the build with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- **`xcode-select` error:** `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

---

Task board and status: [TASKS.md](TASKS.md) · Demo walkthrough: [docs/run-of-show.html](docs/run-of-show.html) · Google setup: [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)

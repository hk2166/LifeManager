# Life OS

AI layer over email + calendar: commitment extraction, a "waiting on" tracker, and a one-tap voice memo that transcribes, classifies, and files itself. Full plan and task IDs: [TASKS.md](TASKS.md).

## Layout

npm workspaces:

- `apps/api` — Express + Postgres/pgvector. Ingestion, extraction, memo pipeline.
- `apps/web` — Vite + React. Judge-facing read dashboard.
- `apps/mobile` — Expo. Capture surface: the quick-memo tab.
- `packages/shared` — TypeScript types shared across all three.

## Quickstart

```
npm install
docker compose up -d      # postgres + pgvector on :5432
cp .env.example .env      # fill in keys; see docs/GOOGLE_SETUP.md
npm run db:reset          # migrate + seed the demo corpus
npm run dev               # api :3001 + dashboard :5173
```

Mobile: `npm run start -w mobile`, then open in the iOS simulator. Set `EXPO_PUBLIC_API_URL` to `http://<your-LAN-IP>:3001` when running on a physical phone.

## Status after the initial build

Everything typechecks; DB + API + dashboard verified live against the seeded corpus. The LLM/audio paths are coded but need keys in `.env` before they run.

- Done: T-01…T-05 (scaffold, db, seed corpus - `npm run db:reset` gives 21 threads / 38 messages / 5 events), T-06/T-07/T-10 (OAuth + Gmail backfill + source links), T-11/T-12 (extractor + eval), T-18…T-20 (memo pipeline + eval), T-21/T-22 (dashboard, verified in browser), T-25…T-28 (Expo app - typechecked and Metro-bundled, not yet run on a device).
- Humans needed for: Google Cloud console setup ([docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)), API keys, first simulator/device run with a real microphone, T-29/T-30 demo tuning + rehearsal.

First manual steps once keys exist:

```
npm run demo:reset        # wipe + migrate + seed + run the extractor
npm run eval:extraction   # T-12: precision/recall vs labeled corpus
npm run eval:memos        # T-20: classification accuracy + threshold sweep
```

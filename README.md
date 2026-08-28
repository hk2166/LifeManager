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

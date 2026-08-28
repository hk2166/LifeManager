# Life OS

AI layer over email + calendar: commitment extraction, a "waiting on" tracker, and a one-tap voice memo that transcribes, classifies, and files itself. Full plan and task IDs: [TASKS.md](TASKS.md).

**New here? Start with [SETUP.md](SETUP.md)** — step-by-step local setup for the whole team.

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

## Status: AI layer validated live

Full pipeline verified end-to-end with real API keys against the seeded corpus:

- **Commitment extraction (T-12): 90.9% precision / 90.9% recall** — passes both ACs (recall ≥80%, ≤2 spurious on negatives). `npm run eval:extraction`.
- **Memo classification (T-20): 93.3% top-1 accuracy; 95.5% silent-routing precision at the 0.8 threshold** — passes both ACs. `npm run eval:memos`.
- **Ask-memory, pre-meeting brief, end-of-day digest** — all confirmed live (correct answers, source links, clean output). Dashboard renders 6 owed / 5 waiting-on with source drawers and working briefs.
- Google connected to a real inbox (read-only); 564 real emails embedded so Ask searches real + seed.

Two robustness fixes landed during validation: `structured()` now recovers stringified/double-encoded tool output (this alone took extraction recall from 45% → 91%), and briefs coerce model bullets to a clean array.

---

## Earlier build notes

All P0 **and P1/P2 code** is in; everything typechecks.

- Done: T-01…T-05 (scaffold, db, seed corpus - `npm run db:reset` gives 21 threads / 38 messages / 5 events), T-06…T-10 (OAuth, Gmail backfill + 2-min live sync, calendar sync, source links), T-11…T-17 (extractor + eval, embeddings, ask-memory, brief, digest, anticipation), T-18…T-20 (memo pipeline + eval), T-21…T-24 (dashboard, verified in browser), T-25…T-28 (Expo app - typechecked and Metro-bundled, not yet run on a device), T-34 (nudge drafts, copy-only). The API also runs an auto-tick: every 2 min it syncs mail + calendar, then incrementally extracts/embeds new threads - so a live "email arrives → commitment appears" moment needs zero manual steps.
- Humans needed for: Google Cloud console setup ([docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)), API keys, first simulator/device run with a real microphone, T-29/T-30 demo tuning + rehearsal. Roadmap slide for the closer: [docs/roadmap-slide.html](docs/roadmap-slide.html).

First manual steps once keys exist:

```
npm run demo:reset        # wipe + migrate + seed + extract + embed + anticipate
npm run eval:extraction   # T-12: precision/recall vs labeled corpus
npm run eval:memos        # T-20: classification accuracy + threshold sweep
```

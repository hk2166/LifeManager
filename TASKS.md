# Life OS — Task Board

**Status: built and validated.** Every P0/P1/P2 task is implemented and verified end-to-end with live keys and a real inbox. The app runs on the iPhone 17 simulator; the full voice-memo flow was exercised on-device. What's left (`- [ ]` below) is demo-day rehearsal — human work, not code.

- `- [x]` done and verified · `- [~]` partial · `- [ ]` not started
- **Owner** column intentionally omitted — reassign freely; the build is single-threaded now.
- The exact demo walkthrough lives in [docs/run-of-show.html](docs/run-of-show.html). Roadmap slide: [docs/roadmap-slide.html](docs/roadmap-slide.html).

---

## Scope decisions and non-goals

- **Integrations shipped: Gmail + Google Calendar, read-only.** Connected to a real inbox (`hemant.k@adypu.edu.in`) via OAuth; 564 real emails ingested and embedded.
- **WhatsApp and Slack — roadmap only, not built.** They live on the closing slide and nowhere in the code.
- **Two surfaces, no duplication:** web dashboard = the read/judge surface (Today, Commitments, Waiting On, Ask); Expo mobile = capture (one-tap memo) + lightweight lists.
- **Commitments and "waiting on" are one pipeline** with a `direction` field, two tabs.
- **Seed corpus is the demo stage.** The real inbox has zero person-to-person commitments (it's promo/transactional), so the 11 demo commitments come from the seeded story. Ask-memory and anticipation run over real + seed.
- **Non-goals:** multi-user/auth, streaming transcription, multi-intent memos, Android, writes to Gmail/Calendar, push notifications (brief is on-demand), auto-sending anything.

### Key technical decisions

| Area | Choice |
|---|---|
| LLM | Claude Sonnet 5 (`claude-sonnet-5`), forced tool-use for structured output |
| Transcription | OpenAI Whisper (`whisper-1`); ~2s on a 15s clip |
| Embeddings | OpenAI `text-embedding-3-small` (1536-d) in pgvector |
| Memo audio | expo-audio record-then-upload; `File.upload()` multipart (SDK 57's fetch rejects RN FormData) |
| Confidence gate | below `CLASSIFY_CONFIDENCE_MIN=0.8` → confirmation chip, never a silent guess |
| Cost control | automated-sender pre-filter skips no-reply mail before the LLM (~50% fewer calls) |

---

## Phase 0 — Setup & infra

- [x] **T-01** Monorepo scaffold (api / web / mobile / shared), npm workspaces · P0
- [x] **T-02** Postgres + pgvector via docker-compose, migrations, migration runner · P0
- [x] **T-03** Google Cloud project, Gmail + Calendar APIs, OAuth consent (Testing) · P0 — *done in-console; client `life-os-api`*
- [x] **T-04** API keys wired (Anthropic + OpenAI), healthcheck round-trips both · P0
- [x] **T-05** Seed demo corpus — 21 threads / 38 messages / 5 events, labeled ground truth · P0

## Phase 1 — Data ingestion

- [x] **T-06** Google OAuth connect flow, tokens persisted + auto-refresh · P0 — *connected, refresh token stored*
- [x] **T-07** Gmail 90-day backfill, MIME→clean text, quoted-reply stripping, idempotent · P0 — *564 real messages*
- [x] **T-08** Incremental mail sync (2-min poll) · P1
- [x] **T-09** Calendar sync, attendees resolved · P1
- [x] **T-10** Source-link plumbing: item → source message → Gmail deeplink · P0

## Phase 2 — AI layer

- [x] **T-11** Commitment/waiting-on extractor (structured output, `direction`, confidence) · P0
- [x] **T-12** Extraction eval on labeled corpus · P0 — **90.9% precision / 90.9% recall, both ACs pass**
- [x] **T-13** Embeddings + pgvector search over messages · P1 — *603/603 embedded*
- [x] **T-14** Ask-memory: retrieve → answer with source citations, refuses when unknown · P1
- [x] **T-15** Pre-meeting brief: attendee history + open loops → structured brief (~4s) · P1
- [x] **T-16** End-of-day digest (on-demand) · P1
- [x] **T-17** Anticipation scan: renewals/bills/appointments/deadlines · P2 — *6 items, incl. real inbox signals*
- [x] **T-18** Transcription integration, latency logged · P0 — *~2s p50*
- [x] **T-19** Memo classify + route (6 types, entities, confidence gate) · P0
- [x] **T-20** Memo eval set + threshold tuning · P0 — **93.3% top-1, 95.5% silent-routing precision at 0.8**

## Phase 3 — Frontends (web dashboard + mobile)

- [x] **T-21** Dashboard shell: nav + 3–5s polling · P0
- [x] **T-22** Commitments + Waiting On views, source drawer · P0
- [x] **T-23** Ask view: question → answer + clickable sources · P1
- [x] **T-24** Today view: meeting card → brief, digest, upcoming · P1
- [x] **T-25** Expo shell: tab bar with center memo button, Today + Items lists · P0
- [x] **T-26** Memo capture UI: one-tap record, states, retry-preserves-audio · P0
- [x] **T-27** Memo pipeline wired end-to-end · P0 — *verified on device: record → route → dashboard*
- [x] **T-28** Confirmation chip + memo detail with audio playback · P0 — *audio + transcript linked to item*

## Phase 4 — Demo polish

- [x] **T-32** Roadmap slide (WhatsApp, Slack, anticipation, push) · P1
- [x] **T-34** "Draft a nudge" on waiting-on items, copy-only · P2
- [~] **T-29** Deterministic demo state + scripted reset · P0 — *`npm run demo:reset` works; final story-tuning pass optional*
- [~] **T-33** Demo-path empty/loading/error states · P1 — *built and verified live; no raw errors on the demo path*
- [ ] **T-30** Demo dry-runs ×3 against a 3:00 timer, one on a phone hotspot · P0 — **rehearsal, do before stage**
- [ ] **T-31** Fallback screen-recording of the full flow, offline-playable · P1 — **needs the real spoken flow captured**

## Beyond the original plan (done this build)

- [x] `structured()` recovers stringified/double-encoded tool output — took extraction recall 45% → 91%
- [x] Automated-sender pre-filter before extraction (real-inbox cost control)
- [x] Mobile upload via `File.upload()` (fixes SDK 57 FormData rejection)
- [x] SafeAreaView → `react-native-safe-area-context` (removes deprecation, correct insets)
- [x] Run-of-show demo cue sheet ([docs/run-of-show.html](docs/run-of-show.html))

---

## Remaining checklist (all human, all demo-day)

- [ ] Rehearse the [run-of-show](docs/run-of-show.html) end-to-end against a 3:00 timer (**T-30**)
- [ ] Do one rehearsal on a phone hotspot, not venue wifi (**T-30**)
- [ ] Record the fallback video while doing a clean run (**T-31**)
- [ ] Speak a real memo on the phone to confirm live classification in the room (mic-in-a-loud-hall check)
- [ ] Optional: final seed-story tuning so every beat fires identically (**T-29**)

---

## Critical path — what makes the demo work

`T-01 → T-02/03 → T-06 → T-07 → T-11 → T-12 → T-21 → T-22` (inbox) and
`T-25 → T-26 → T-27 (← T-18/19/20) → T-28` (memo), converging on `T-29 → T-30`.
**All green except T-30** (rehearsal). If time runs out on stage, cut in order: T-33 polish → T-16 digest → T-15/24 brief → T-13/14/23 ask. Never cut the commitments/waiting-on read or the self-filing voice memo.

## Risks — how they resolved

- **R1 (plan didn't fit):** it fit — the two-surface split held, and structured-output/upload bugs were the real time sinks, not scope.
- **R2 (transcription latency):** ~2s p50 on Whisper; no Deepgram swap needed. Untested in a loud hall — the one open unknown (see remaining checklist).
- **R3 (classification reliability):** 93.3% top-1; the 0.8 confidence gate routes 95.5%-correct silently and chips the rest — verified on-device with a low-confidence input producing a chip, not a wrong guess.
- **R4 (soft-language false positives):** 0 spurious on the 10 negative threads (100% precision).
- **R5 (Google gotchas):** MIME parsing clean; secrets now hashed by Google (retrieved via download at creation); read-only scopes only.
- **R6 (two frontends, few hands):** no feature built twice; `packages/shared` holds the types.
- **Environment (new):** iOS simulator needed a runtime install; CocoaPods needed a reinstall (Ruby 4.0.3) + UTF-8 locale. Documented in the README and memory.

# Life OS — Hackathon Task Plan

**Format:** ~48-hour weekend hackathon · **Team:** 3 builders · **Stack:** TypeScript monorepo — Node API + Postgres/pgvector, React web dashboard, Expo (React Native) mobile app · **Written:** 2026-08-28

---

## 1. Scope decisions and non-goals

Read this section before picking up a task. If a piece of work isn't justified by a line here, it's drift.

### What we are building (demo scope)

- **Integrations: Gmail + Google Calendar only**, read-only scopes, against a **seeded demo Google account** — not anyone's live inbox. Determinism on stage beats authenticity; it also keeps private mail off the projector.
- **Commitment extraction and "waiting on" are one feature** internally: a single extractor that emits items with a `direction` field (`owed_by_me` / `owed_to_me`). Two tabs, one pipeline.
- **Mobile quick-memo tab** end to end: one-tap record → upload → transcribe → LLM classify into {reminder, task, calendar event, note, commitment, shopping/errand} → entity extraction (date/time/person) → route to store. Ambiguous classifications surface a **one-tap confirmation chip**; the system never guesses silently below the confidence threshold. Raw audio + transcript are retained and linked to the created item.
- **Two surfaces, strictly divided** (team decision): the **web dashboard is the judge-facing read surface** (Today, Commitments, Waiting On, Ask) and the **mobile app is the capture surface** (memo button + lightweight item lists). No feature gets built twice. The dashboard takes no actions; the phone renders no briefs.
- **Ask-memory, pre-meeting brief, and digest** are P1: in scope, first candidates to cut (see §5).

### Key technical decisions (so we don't re-litigate them at 2am)

| Decision | Choice | Why |
|---|---|---|
| Email freshness | Poll every ~2 min (P1) on top of a 90-day backfill | Gmail push/watch + webhook infra isn't worth it for a demo |
| Dashboard freshness | Poll API every 3–5s | No websockets; polling is indistinguishable on stage |
| Memo audio | Record-then-upload (expo-audio), not streamed | Streaming transcription is a rabbit hole; clips are <30s anyway |
| Transcription | Whisper API first; Deepgram is the pre-agreed swap if p50 latency >5s | Swap is ~1h; decide Saturday morning, not Sunday |
| LLM | Claude Sonnet 5 (`claude-sonnet-5`) with structured/tool-use output for extraction + classification | Fast, cheap, strong at structured JSON |
| Embeddings | OpenAI text-embedding-3-small + pgvector | Same key as Whisper - one signup fewer; Anthropic API doesn't provide embeddings |
| Memo → calendar event | Routes to **our own** events store, shown in-app | Writing to Google Calendar needs write scopes; we stay read-only with Google |
| Auth | Single-user, pre-connected demo account, shared API secret | Multi-user auth is production work, not demo work |

### Non-goals (out of scope for the build)

- **WhatsApp integration — roadmap only. Not built this weekend.**
- **Slack integration — roadmap only. Not built this weekend.**
  Both appear on the closing roadmap slide (T-32) and nowhere in the codebase.
- No multi-user support, tenancy, or real auth.
- No push notifications — the pre-meeting brief is **on-demand** (tap the meeting card), not "10 minutes before" scheduling.
- No auto-sending of anything, ever. The stretch "nudge" feature produces a draft only.
- No writes to Gmail or Google Calendar (read-only scopes).
- No streaming transcription; no multi-intent memos (one memo → one item; multi-intent is a stretch note in §7).
- No Android testing — demo runs on iOS (simulator or one iPhone).
- No production deployment, security hardening, or billing thinking.

---

## 2. Legend

- **P0** — demo breaks without it. **P1** — demo is weaker without it. **P2** — stretch.
- **Est** — person-hours at hackathon pace, *including* debugging and integration fumbling. These are honest, not aspirational; where honesty means "doesn't fit," that's in §6 rather than hidden in a small number.
- **Deps** — task IDs that must be functional (not polished) first.
- **Owner** — blank; fill in at kickoff. Suggested lanes for 3 people: **A** infra/ingestion → dashboard · **B** AI layer → evals · **C** mobile end-to-end.

---

## 3. Tasks

### Phase 0 — Setup & infra

| ID | Task | Pri | Est | Deps | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| T-01 | Monorepo scaffold (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`), git init, README quickstart | P0 | 2h | – | | (1) Fresh clone → `npm i && docker compose up -d && npm run dev` starts API + web. (2) Expo app boots in iOS simulator and hits the API healthcheck. |
| T-02 | Postgres + pgvector via docker-compose; baseline migrations (messages, threads, events, items, memos) | P0 | 2h | T-01 | | (1) Migrations apply clean on empty DB. (2) `vector` extension enabled and queryable. |
| T-03 | Google Cloud project: enable Gmail + Calendar APIs, OAuth consent screen in Testing mode, credentials; demo account added as test user | P0 | 1.5h | – | | (1) Client ID/secret in `.env`. (2) Consent flow reachable and completable by the demo account. |
| T-04 | API keys wired: Anthropic + transcription provider, spend caps set, `.env.example` committed | P0 | 1h | T-01 | | (1) Healthcheck endpoint round-trips both APIs. (2) `.env.example` lists every required var. |
| T-05 | Demo Gmail account + seed corpus v1: ~40 emails + ~5 calendar events scripted as one coherent story | P0 | 4h | – | | (1) Corpus plants ≥8 commitments (both directions), 1 decision buried in an old thread, 1 upcoming renewal, 1 meeting with rich history. (2) Seeding is re-runnable from a script or documented steps. |

### Phase 1 — Data ingestion

| ID | Task | Pri | Est | Deps | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| T-06 | Google OAuth connect flow in API; tokens persisted and auto-refreshed | P0 | 3h | T-02, T-03 | | (1) One documented command/URL connects the demo account. (2) Tokens survive an API restart and refresh after expiry without re-consent. |
| T-07 | Gmail backfill: last 90 days → MIME parse → clean-text normalization → store with thread grouping | P0 | 5h | T-06 | | (1) Entire seed corpus lands in the DB. (2) An HTML-heavy email is stored as readable text. (3) Re-running backfill creates zero duplicates. |
| T-08 | Incremental mail sync: poll every ~2 min for new messages | P1 | 2h | T-07 | | (1) An email sent to the demo account appears in the DB within 2 min, no restart. |
| T-09 | Calendar sync: next 7 days of events with attendees resolved to email addresses | P1 | 2h | T-06 | | (1) Seeded events in DB with attendee emails. (2) Recurring events don't duplicate. |
| T-10 | Source-link plumbing: any item → source message ID → stored text + Gmail web deeplink | P0 | 1h | T-07 | | (1) Every extracted item resolves to its exact source message. (2) Deeplink opens the right thread in Gmail web. |

### Phase 2 — AI layer

| ID | Task | Pri | Est | Deps | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| T-11 | Commitment/waiting-on extractor: per-thread LLM pass → `{text, counterparty, due_date, direction, source_id, confidence}` | P0 | 6h | T-04, T-07 | | (1) ≥80% of planted commitments found with correct direction + counterparty on the seed corpus. (2) Re-running extraction creates no duplicate items (dedupe across quoted replies). |
| T-12 | Extraction eval: 25 labeled threads (incl. soft-language negatives like "I'll take a look"), scripted precision/recall, prompt iteration | P0 | 3h | T-05, T-11 | | (1) Eval script prints precision/recall in one command. (2) ≤2 spurious commitments across the negative set at the display threshold. |
| T-13 | Embeddings + pgvector search over messages | P1 | 3h | T-07 | | (1) Top-5 retrieval for 5 canned queries includes the correct thread every time. |
| T-14 | Ask-memory endpoint: question → retrieve → answer with source citations | P1 | 3h | T-13 | | (1) "What did we decide about [seeded topic]?" returns the right decision with ≥1 correct source link. (2) An unanswerable question says so instead of fabricating. |
| T-15 | Pre-meeting brief: event → attendee thread history + open items → structured brief | P1 | 3h | T-09, T-11 | | (1) Brief for the seeded meeting names the open commitment and summarizes the latest thread. (2) Generates in <10s. |
| T-16 | End-of-day digest generator (on-demand) | P1 | 2h | T-08, T-11 | | (1) Digest covers today's new items + owed/waiting counts in readable prose. (2) Generates in <15s. |
| T-17 | Anticipation scan: renewals/bills/appointments detected from inbox | P2 | 3h | T-07 | | (1) Seeded renewal email surfaces as an upcoming item with the correct date. |
| T-18 | Transcription integration: audio upload endpoint → text, latency logged per call | P0 | 2h | T-04 | | (1) A 15s clip transcribes in ≤5s p50. (2) Accuracy spot-checked on 10 team-recorded clips. |
| T-19 | Memo classify + route: transcript → one of 6 types + `{date, time, person}` entities + confidence; below threshold → `needs_confirmation`, never silent | P0 | 4h | T-02, T-04 | | (1) ≥85% top-1 on the eval set (T-20). (2) Of memos routed *silently*, ≥95% are correctly typed. (3) Extracted dates resolve relative phrases ("Thursday") to real dates. |
| T-20 | Memo eval set: 30 labeled utterances incl. deliberately ambiguous ones; tune the confirmation threshold | P0 | 2h | T-19 | | (1) One-command eval prints accuracy + silent-routing precision. (2) Threshold chosen so silent misroutes on the set ≈ 0. |

### Phase 3 — Frontends (web dashboard + mobile app)

*Deviates from the original "mobile app" phase name per the team's surface decision: dashboard = read, mobile = capture.*

| ID | Task | Pri | Est | Deps | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| T-21 | Web dashboard shell: nav (Today / Commitments / Waiting On / Ask), API client, 3–5s polling | P0 | 3h | T-01, T-02 | | (1) All views navigable against the live API. (2) A new backend item appears within 5s without a reload. |
| T-22 | Commitments + Waiting On views: lists with counterparty + due date, click → source email drawer | P0 | 4h | T-10, T-11, T-21 | | (1) Seeded items render in the correct tab by direction, sorted by due date. (2) Clicking any item opens its exact source email text. |
| T-23 | Ask view: question box → answer + clickable source links | P1 | 2h | T-14, T-21 | | (1) The canned demo question round-trips in the UI in <15s with visible, working sources. |
| T-24 | Today view: next-meeting card → brief panel; digest button; upcoming section (if T-17 exists) | P1 | 3h | T-15, T-21 | | (1) One click on the meeting card renders the brief. (2) View degrades gracefully when digest/anticipation aren't built. |
| T-25 | Expo shell: tab bar with prominent center memo button; Today + Items tabs as lightweight lists | P0 | 4h | T-01 | | (1) Cold start → recording in ≤2 taps. (2) Lists render live API data. |
| T-26 | Memo capture UI: one-tap record, stop, visible states (recording / uploading / transcribing), failure retry | P0 | 4h | T-25 | | (1) Happy path ends in a "routed" result card. (2) Killing the network mid-upload shows retry and the audio is not lost. |
| T-27 | Memo pipeline wiring end-to-end: upload → transcribe (T-18) → classify/route (T-19) → result card ("Added to Commitments: …") | P0 | 3h | T-18, T-19, T-26 | | (1) Speaking "remind me to send Priya the deck Thursday" creates a correctly-dated item. (2) The item is visible on the web dashboard within 10s. |
| T-28 | Confirmation chip + memo detail: ambiguous memo → one-tap chip; detail view plays raw audio + shows transcript, linked from the created item | P0 | 3h | T-27 | | (1) An ambiguous utterance surfaces a chip instead of a silent guess. (2) Chip tap files the item into the chosen store. (3) From the created item you can reach and play the original audio and read the transcript. |

### Phase 4 — Demo polish

| ID | Task | Pri | Est | Deps | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| T-29 | Seed corpus v2: tune the story so every demo beat fires deterministically; scripted reset + re-ingest | P0 | 3h | T-22, T-27 | | (1) From a scripted reset, every demo beat produces the expected output 3 runs in a row. |
| T-30 | Demo dry-runs ×3 against a 3:00 timer; fix top papercuts only | P0 | 3h | all P0 | | (1) Full script fits in 3:00. (2) 3 clean consecutive runs, at least one on a phone hotspot instead of venue wifi. |
| T-31 | Fallback screen-recording of the full flow, playable offline | P1 | 1h | T-30 | | (1) Video covers every beat and plays from local disk with no network. |
| T-32 | Roadmap slide (WhatsApp, Slack, anticipation, push briefs) + 20s problem-framing open | P1 | 1h | – | | (1) Deliverable in ≤30s total of stage time. |
| T-33 | Demo-path empty/loading/error states (dashboard + memo flow only) | P1 | 2h | T-22, T-28 | | (1) No raw JSON, `undefined`, or infinite spinner anywhere on the demo path. |
| T-34 | "Draft a nudge" on waiting-on items → follow-up email draft, copy-to-clipboard only | P2 | 2h | T-22 | | (1) Draft references the original ask and elapsed time. (2) Nothing is ever auto-sent. |

---

## 4. Effort totals

| Phase | P0 | P1 | P2 |
|---|---|---|---|
| 0 — Setup & infra | 10.5h | – | – |
| 1 — Ingestion | 9h | 4h | – |
| 2 — AI layer | 17h | 11h | 3h |
| 3 — Frontends | 21h | 5h | – |
| 4 — Demo polish | 6h | 4h | 2h |
| **Total** | **63.5h** | **24h** | **5h** |

Realistic capacity: 3 people × 16–20 focused hours over a 48h weekend ≈ **50–60 person-hours**. See R1 in §6 — this table is the plan's most important row.

---

## 5. Critical path to a working demo

Two chains run in parallel and converge on rehearsal. Everything listed here is P0; if a critical-path task slips, something below the cut line pays for it — not sleep on Sunday.

**Inbox chain (lanes A + B):**
`T-01 → T-02/T-03 → T-06 → T-07 → T-11 → T-12 → T-21 → T-22 → T-10`
(T-05, the seed corpus, must exist before T-12 and gates T-29.)

**Memo chain (lane C, with B feeding T-18/T-19):**
`T-01 → T-25 → T-26 → T-27 (← T-18, T-19, T-20) → T-28`

**Convergence:** `T-29 → T-30`

**Full critical-path set:** T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-10, T-11, T-12, T-18, T-19, T-20, T-21, T-22, T-25, T-26, T-27, T-28, T-29, T-30.

### Cut order when time runs out (first cut → last cut)

1. **T-34** nudge drafts (P2)
2. **T-17** anticipation engine (P2)
3. **T-16** digest — lowest demo value per hour of the P1s
4. **T-09 + T-15 + T-24** the calendar/brief beat (demo script beat 3 disappears)
5. **T-13 + T-14 + T-23** ask-memory (beat 2 disappears — painful; it's the "technical depth" claim, so cut only if the memo pipeline is at risk)
6. **T-33** polish states
7. **T-08** live mail polling (backfilled data carries the demo)
8. Structural last resort: strip the mobile Items lists from T-25 to capture-only; the dashboard shows everything

**Never cut:** commitments + waiting-on from real email, and the voice memo that routes itself. Below that line it stops being Life OS. **Also never cut T-31 (fallback video) and T-32 (roadmap slide)** — 2 hours total, and they're the safety net and the closer.

---

## 6. Risks and unknowns

**R1 — The plan does not fit as scoped. This is the headline risk.**
P0 alone is ~63.5h against ~50–60h of real capacity, and that's before any P1 (P0+P1 = 87.5h, which is simply not happening). The two-surface decision (dashboard + mobile) is what pushed P0 over; the phase-3 split (read-only dashboard, capture-only mobile) is the mitigation already baked in. Working agreement: **Saturday 12:00 checkpoint** — if the memo pipeline isn't end-to-end on a device (T-27), cut ask-memory (T-13/14/23) immediately and move lane B onto the memo chain. **Sunday 12:00 feature freeze** — only T-29/T-30/T-31 after that. Recoverable slack if desperate: fold T-12/T-20 into informal spot-checks (~3h back, at accuracy risk — see R3/R4).

**R2 — Transcription latency (flagged unknown).**
Expectation: 2–4s p50 for a 15s clip via Whisper API on decent network. Unknowns: venue wifi (conference networks routinely add multi-second tail latency) and accent/noise robustness on a hackathon floor. Mitigations: clips stay short; audio is persisted server-side before transcription so a timeout never loses the memo; the UI shows honest "transcribing…" state rather than freezing; Deepgram swap is pre-agreed and ~1h if Saturday-morning measurements (T-18 logs latency) show p50 >5s; final rehearsal happens on a phone hotspot (T-30). We are *not* attempting streaming transcription in 48h.

**R3 — LLM memo classification reliability (flagged unknown).**
Six categories with genuinely overlapping semantics — "remind me to send Priya the deck" is defensibly a reminder, a task, *and* a commitment. Expectation with few-shot Sonnet: 85–90% top-1, which means roughly 1 in 8 memos misroutes if we guess silently. The confirmation chip is therefore the product answer, not a patch: tune the threshold (T-20) so silent routes are ≥95% correct and everything else chips. Residual risk: an over-triggering chip makes the product look unsure of itself on stage — the demo uses rehearsed utterances chosen to show one clean silent route *and* one deliberate chip. We do not hard-code demo utterances; if it only works on magic strings, judges' first improvised question kills us.

**R4 — Commitment extraction precision on soft language.**
Polite fluff ("happy to take a look at some point") is the false-positive minefield, and junk items on the Commitments tab are the fastest way to lose credibility. Mitigations: the eval set (T-12) includes soft-language negatives; display is gated on a confidence floor; quoted-reply chains are deduped or extraction double-counts every thread. Honest unknown: prompts get tuned on our seed corpus, so generalization to a messy real inbox is unproven — don't claim it on stage, show the roadmap instead.

**R5 — Google integration gotchas.**
MIME parsing eats time (multipart nesting, HTML-only mail, encodings) — T-07 is sized at 5h for a reason and could still run over. OAuth app in Testing mode: refresh tokens expire after 7 days (irrelevant for the weekend, but re-consent Friday night so the clock starts fresh) and any live connect shows the scary "unverified app" screen — the demo account is connected *before* the demo, never on stage. API quotas are a non-issue at this scale.

**R6 — Two frontends, three people.**
Every hour the dashboard and mobile app duplicate a feature is an hour taken from the AI layer that wins the prize. Enforcement is structural: dashboard renders, mobile captures, `packages/shared` owns the types. If lane C falls behind, mobile Items lists are the first structural cut (§5 #8) — the memo result card plus the dashboard updating is a complete story.

**R7 — The live cross-device moment.**
Beat 4's payoff — speak into the phone, item appears on the projected dashboard — depends on venue network twice (upload + dashboard poll). Rehearse on hotspot, keep the fallback video (T-31) cued in a tab, and if the room network dies mid-demo, narrate over the video without apologizing.

**R8 — Things that do not fit in 48 hours (pre-declared, not discovered Sunday).**
Push-notification "10 minutes before" briefs (on-demand instead), streaming transcription, multi-intent memos (one recording → several items — great stretch, real parser work), Android, multi-user auth, and obviously WhatsApp/Slack. Anything from this list that sneaks into a lane's plan is scope drift; point at this section.

---

## 7. Demo script (3:00)

Projector shows the **web dashboard**; the phone (simulator mirrored, or a phone on camera) enters at beat 4. Reset state via T-29's script before going on. If a beat's tasks got cut, skip the beat and let beats 1 and 4 breathe — they are the demo.

| # | Time | Beat — what judges see | Spoken line (gist) | Requires |
|---|---|---|---|---|
| 0 | 0:00–0:20 | Problem framing; dashboard Today view already open | "Your life is split across four inboxes, and the tax isn't reading them — it's *remembering* them. Life OS does the remembering." | T-21, T-32 |
| 1 | 0:20–1:00 | Commitments tab: items with names + deadlines; click one → exact source email. Flip to Waiting On: "what others owe *you*" | "It read this inbox. You told Priya you'd send the deck by Thursday — here's the sentence where you said it. And here's what you're still waiting on from everyone else — the feature no tool has." | T-05→T-07, T-10, T-11, T-12, T-22, T-29 |
| 2 | 1:00–1:25 | Ask view: type "What did we decide about the venue vendor?" → answer + source link to a months-old thread | "The thread died in June. The memory didn't." | T-13, T-14, T-23 *(cut line: skip if unbuilt)* |
| 3 | 1:25–1:50 | Today view: tap the upcoming meeting → brief with open loops for that person | "Ten minutes before your call, everything you owe them and everything they owe you — no tab archaeology." | T-09, T-15, T-24 *(cut line: skip if unbuilt)* |
| 4 | 1:50–2:40 | Phone: one tap, speak *"Remind me to send Priya the deck Thursday."* → routed card on phone → **item appears on the projected dashboard**. Second memo, deliberately ambiguous → confirmation chip, one tap files it. Open the item → play the raw audio | "Capture takes one tap. It transcribed, classified, and filed it — and when it isn't sure, it asks instead of guessing. The original audio is always attached." | T-18, T-19, T-20, T-25, T-26, T-27, T-28 |
| 5 | 2:40–3:00 | Roadmap slide: WhatsApp, Slack, anticipation engine, push briefs | "Email and calendar this weekend. Every other inbox is the same pipeline. The memory layer is the moat." | T-32 |

**Contingency:** T-31's video sits cued in an adjacent tab. Any live failure → switch tabs, keep talking, zero apology.

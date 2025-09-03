Local-First iPhone Assistant — Implementation Plan (React Native + Expo)
Goal (confirmed)

Build an iOS-first personal assistant in React Native + Expo that:

Runs a fully on-device, trainable NLP stack (no cloud inference) to understand spoken/typed commands.

MVP actions: Calendar events, Reminders, Apple Notes, Email (Gmail provider; compose UI for dev verification, real read/send later in Phase 2).

Uses on-device STT for voice commands at MVP.

Connects to Apple native apps via Expo wrappers of Apple frameworks (e.g., EventKit through expo-calendar) or Shortcuts/x-callback when no public SDK exists (Apple Notes).

Stores all raw and derived data locally during alpha.

Confirms actions when model confidence < 0.81, executes automatically when ≥ 0.91.

Architecture (high-level)

Speech/Typing → On-device Intent Model → Slot/Entity Extraction → Policy/Dispatcher → Connector Layer (EventKit via Expo, Shortcuts, Gmail API) → Confirm (gated) → Execute → Log & Learn

Intent Model (on-device, trainable):

MVP: rules + TF-IDF + kNN memory with immediate learning (no gradients).

Upgrade: tfjs encoder (USE-lite/MiniLM) + centroid classifier; periodic mini-training of a small dense head on-device (only when charging & idle).

Slots: chrono-node for date/time; heuristics for title/subject/recipients; contact alias map learned from corrections.

Policy/Dispatcher: intents_registry.json (download above) defines required slots, parsers, confirmation templates, handler IDs.

Connectors:

Calendar & Reminders → EventKit via expo-calendar (JS talks to EventKit under the hood; no Swift needed).

Apple Notes → Shortcuts (shortcuts://x-callback-url) invoked via RN Linking.

Email → Gmail (MVP provider) for read/send; expo-mail-composer retained as compose-only fallback for verification.

EventKit vs Expo: EventKit is Apple’s native framework for Calendar/Reminders. expo-calendar wraps EventKit on iOS so you can call it from JS. For Notes, Apple exposes no public SDK—so we use Shortcuts.

Phases with Objectives, Implementation Steps, Acceptance Criteria
Phase 1 — Short Term (MVP, ~2–3 focused days)

Objectives

Voice + text commands.

Actions: Calendar events, Reminders, Apple Notes (Shortcut), Email compose UI.

All NLP on-device; store all data; confidence gates 0.81/0.91.

Dataset & tests: 1000 training examples, 100+ golden slot cases.

Implementation Steps

Project setup

Expo app with Dev Client (needed for speech).

Add: expo-calendar, expo-linking, expo-mail-composer, chrono-node, a lightweight tokenizer (winkNLP or custom), and on-device speech via react-native-voice (Apple Speech).

Local persistence: start with expo-sqlite or JSON files for:
intent_memory.jsonl, prototypes.json, slot_overrides.json, metrics.json, jobs_queue.jsonl.

Speech input (MVP)

Integrate react-native-voice start/stop & transcripts; fall back to text input.

Settings toggle for “strict offline STT” (wire later to Whisper in Phase 3).

Intent + Slots

Classifier v0: rules + TF-IDF + kNN memory. Confidence from neighbor margins + rule hits.

Thresholds: confirm <0.81, auto ≥0.91.

Slots: chrono-node (forwardDate), heuristics for title/subject/body; email parsing; contact aliases (learn).

Dispatcher & Registry

Use intents_registry.json (download).

Intents covered: create_event, add_reminder, create_note, read_email (placeholder), send_email (compose path), none.

Connectors

Calendar/Reminders: expo-calendar (EventKit) create/read/update.

Notes (Apple Notes): run a user Shortcut like “Append To Notes” via Linking.openURL("shortcuts://…"); pass text payload.

Email: expo-mail-composer (compose UI) to validate end-to-end flow during dev.

Learning UX

One-tap correction sheet (change intent, edit key slots).

“Always do this” adds a phrase rule or boosts memory; write to intent_memory.jsonl and update kNN/centroids immediately.

Evaluation

Use intent_training.csv (1000) and slot_tests.csv (120) to run nightly checks.

Show confusion matrix & per-intent P/R in an in-app diagnostics screen.

Acceptance Criteria

Voice → create event, create reminder, append/create Apple Note, compose email, all on device.

Accuracy ≥ 80% on the seed set; confirmations only below 0.81; auto at ≥ 0.91.

Corrections immediately adjust predictions (repeat the same utterance to verify).

All transcripts, decisions, slots, actions logged locally (alpha policy: store all).

Phase 2 — Medium Term (2–4 weeks)

Objectives

Gmail read/send (MVP provider) with tokens stored locally; no cloud LLM.

Push real-world intent accuracy to ≥ 90% via centroid model + mini-training.

Add robust queueing for offline/online actions; idempotent handlers.

Expand native coverage (Contacts/Photos/Camera/SMS Compose/Maps).

Implementation Steps

Email integration (Gmail-only for MVP)

OAuth in-app; tokens in Keychain/SecureStore.

Read: list unread, by label/time; thread summaries.

Send: drafts + send; explicit user confirmation for any auto-send.

Keep compose UI as fallback.

Classifier upgrade

Add tfjs encoder + per-intent centroids; hybrid decision (rules/model vs centroid nearest).

Mini-training: retrain only a small dense/logreg head on recent corrections when charging & idle; rollback if metrics drop.

Queues & reliability

Local job queue for deferred actions (e.g., sending when offline); idempotency keys; retries with backoff.

Crash-safe persistence; resume on app relaunch.

Coverage expansion

Contacts via expo-contacts (resolve names → email/phone).

Camera via expo-camera; Photos via expo-media-library.

SMS compose via expo-sms; Maps via Linking to maps://.

Additional Shortcuts for Clock (timers/alarms), Podcasts, etc.

Diagnostics

Weekly active-learning review UI; surface low-confidence utterances for labeling.

Versioned model artifacts; before/after metrics; regression guardrails.

Acceptance Criteria

Gmail read/send fully functional and gated by explicit user consent.

Rolling last-7-days ≥ 90% intent accuracy on real usage.

Queue persists across restarts; no duplicate side effects; all handlers idempotent.

Expanded native actions (see MVP matrix below) work with confirmations and logging.

Phase 3 — Long Term (4–8+ weeks)

Objectives

Strict offline STT (Whisper tiny/base via RN bridge).

OTA model pipeline with versioned rollback.

Broader Apple app coverage via Shortcuts and supported SDKs.

Multi-step planning (“find last photo → attach → email Jane → add reminder”).

Implementation Steps

Strict offline STT

Integrate a RN bridge to whisper.cpp; ship tiny/base models (quantized).

Device-profiles for latency/quality; toggle in settings.

Model packaging & OTA

Version tfjs model; enable OTA swap with metric checks.

Reproducible training pipeline (seed + corrections ⇒ model).

Advanced skills

Multi-intent planning with local policy graphs; ask for confirm for destructive/ambiguous steps.

Shortcut library per app with normalized parameters.

Android readiness

Introduce Android equivalents where possible, keep iOS-first features guarded.

Acceptance Criteria

Whisper mode runs offline with acceptable latency (<1.2s for short utterances on A15+).

OTA update flow passes regression guardrails (no >2% metric drop).

80%+ of Eventual Capabilities list supported (via SDK or Shortcuts) with clear user consent prompts.

MVP Capabilities (ship in Phase 1/2)

Calendar (EventKit via expo-calendar): create/read/update events, default 30-min, configurable durations.

Reminders (EventKit via expo-calendar): create/read/update dated/undated reminders.

Apple Notes (Shortcuts via RN Linking): append/create note with text payloads.

Email (Gmail provider):

Phase 1: compose UI for verification.

Phase 2: OAuth, read (list/search), send/draft.

Contacts (expo-contacts, Phase 2): name/email/phone resolution for slots.

Speech: Apple Speech via react-native-voice (on-device), Whisper option later.

Eventual Capabilities (separate; not “golden” until moved to MVP)

Phone/FaceTime: initiate calls (tel://) or FaceTime (facetime://).

Messages: SMS/iMessage compose via expo-sms (no read API).

Camera/Photos: capture via expo-camera; fetch last photo, create albums via expo-media-library.

Files: pick/save via expo-document-picker.

Maps: open directions/search via maps:// and Shortcuts.

Clock: timers/alarms via Shortcuts.

Safari: open URLs via Linking.

Music/Podcasts: limited control via MusicKit/Shortcuts (tokenized dev setup).

Health/Home/Wallet: require native modules (HealthKit/HomeKit/PassKit) and deep consent—consider in later phases.

Data, Learning, and Queues (Alpha)

Store everything: ASR transcripts, utterances, features, predictions, scores, thresholds, slots, confirmation decisions, handler outputs, errors, and user corrections.

Immediate learning: append correction to intent_memory.jsonl → update kNN index and centroids immediately.

Mini-training (Phase 2+): tfjs head retrains on corrections when charging/idle; track pre/post metrics; rollback on regression.

Queue: jobs_queue.jsonl with idempotency keys; retry + backoff; visible UI with cancel/force-run.

Global Acceptance Gates

Confidence: confirm if < 0.81, auto if ≥ 0.91.

Safety: destructive operations (delete/move/send without preview) always require confirm until explicitly disabled per intent.

Privacy: all data local by default; export requires explicit action.

Artifacts (ready to use)

Training set (1000) → intent_training.csv

180 each for create_event, add_reminder, create_note, read_email, send_email, + 100 none.

Balanced phrasing, varied time expressions, names, subjects.

Golden tests (120) → slot_tests.csv

Mixed absolute/relative times, ranges, durations, subject/body/address parsing.

Intent registry → intents_registry.json

confirmThreshold: 0.81, autoThreshold: 0.91.

Parsers, required slots, handlers wired for MVP.

TypeScript interfaces → interfaces.ts

Handler skeletons (Expo) → handlers_skeleton.ts

Next Steps I recommend (concrete)

Import the five files above into your repo (e.g., assets/nlp/ + src/ for TS).

Wire speech → dispatcher → handlers using intents_registry.json.

Run the golden tests against your extractor/handlers; keep fixing heuristics until green.

Turn on logging and the correction sheet; verify immediate learning (kNN override/centroid updates).

Once stable, begin Gmail (read/send) integration in Phase 2 and add Contacts/Camera/Photos as priority “eventual” capabilities.
# PROV — Limitations

What this prototype cannot do, stated plainly. No section here is padded, and
nothing below is a surprise we discovered after submitting — it is the state of
the system as built.

We have split this into three tiers:

- **[Blocking]** — a reviewer following [setup.md](setup.md) will hit this.
- **[Substantive]** — a real limitation of the design, not a bug.
- **[Not built]** — work a production version would need and we did not do.

---

## Contents

**Blocking**
1. [Missing Python dependencies](#1-missing-python-dependencies)
2. [Broken `npm run seed` script](#2-broken-npm-run-seed-script)
3. [Lip-sync model is not vendored](#3-lip-sync-model-is-not-vendored)
4. [ffmpeg is a hard external dependency](#4-ffmpeg-is-a-hard-external-dependency)
5. [A 91 MB model and branch divergence](#5-a-91-mb-model-and-branch-divergence)

**Substantive**
6. [The ML services are deployed separately](#6-the-ml-services-are-deployed-separately)
7. [Browser camera and microphone are required](#7-browser-camera-and-microphone-are-required)
8. [All demo data is synthetic](#8-all-demo-data-is-synthetic)
9. [ML false positives and false negatives](#9-ml-false-positives-and-false-negatives)
10. [Thresholds are unvalidated engineering judgement](#10-thresholds-are-unvalidated-engineering-judgement)
11. [Behaviour is not competence](#11-behaviour-is-not-competence)
12. [Liveness is not implemented](#12-liveness-is-not-implemented)
13. [Challenge curation has a finite bank](#13-challenge-curation-has-a-finite-bank)

**Not built**
14. [Human review is a stub](#14-human-review-is-a-stub)
15. [No authentication or authorisation](#15-no-authentication-or-authorisation)
16. [Production and security](#16-production-and-security)
17. [Scaling and performance](#17-scaling-and-performance)
18. [Other known gaps](#18-other-known-gaps)

---

# Blocking

## 1. Missing Python dependencies

**`requirements.txt` does not list `scikit-learn` or `pypdf`, and the code
imports both.**

| Package | Imported by | Consequence if missing |
| --- | --- | --- |
| `scikit-learn` | `resume_screening/score.py` | `:8002` fails on the first `/shortlist` call |
| `pypdf` | `resume_screening/extract_text.py` | `:8002` returns `422` on every PDF upload |

Both are present in our development virtualenv, so we never noticed until we
checked the manifest against the imports.

**Workaround:**

```bash
pip install -r requirements.txt scikit-learn pypdf
```

**This is documented in [setup.md](setup.md) but it should not be necessary.**
We have not edited `requirements.txt` as part of this documentation submission,
because the brief was to leave application code untouched. It is the first thing
we would fix.

The same applies to the `third_party` anti-spoofing models referenced on the
unmerged branch described in §5.

## 2. Broken `npm run seed` script

```json
"seed": "node --experimental-strip-types scripts/seed.ts"
```

**`web/scripts/seed.ts` does not exist.** `npm run seed` fails with
`MODULE_NOT_FOUND`. The only scripts in `web/scripts/` are `seed-demo.ts`,
`reset-demo.ts` and `verification-flow-test.ts`.

**Use `npm run seed:demo` and `npm run reset:demo`.**

This should be either fixed or deleted from `package.json`. A broken script in a
manifest is a small thing that costs a reviewer five minutes and some trust.

## 3. Lip-sync model is not vendored

The lip-sync signal runs **SyncNet** as a subprocess against a local
`syncnet_python` checkout. That checkout is **gitignored and not in the
repository**, and neither are its weights.

Without `SYNCNET_REPO_DIR`, `score_lipsync()` raises `LipSyncError`, the caller
catches it, and the signal returns a **neutral `0.5` with a diagnostic note**.

**This is the correct behaviour** — a missing signal is reported as missing
rather than silently becoming a pass or a fail — and the note is visible in the
`diagnostics` block of the `/verify` response. But it means that **out of the
box, one of the three integrity signals is inert**, and the fused score is
effectively computed from gaze and audio alone.

Setup instructions are in [setup.md §1](setup.md#optional-lip-sync-model-syncnet).

### Our own documentation is stale on this

`README-ml-anti-gaming.md` and `docs/anti-gaming-paper.md` §2.1 both describe
lip-sync as *"mouth-aspect-ratio vs audio-envelope correlation"*. **That is
wrong** — the implementation is SyncNet. We have flagged the discrepancy in
[ai.md](../ai.md#lip-sync) and left both pre-existing files untouched rather than
silently editing documentation we did not verify the history of.

## 4. ffmpeg is a hard external dependency

`ml/verification/service.py` and `ml/verification/audio.py` both shell out to
`ffmpeg` to demux audio, and `ml/verification/oep_adapter.py` uses `ffprobe`.
Neither is bundled, vendored, or checked for at startup.

- Not on `PATH` ⇒ `/verify` returns **`422 could not extract audio`**, and the
  audio signal degrades to neutral.
- `start-demo.cmd` **hardcodes an absolute ffmpeg path** for one specific
  machine. It will need editing elsewhere.
- A first-time user who skips the ffmpeg install will not find out until they
  submit a clip. There is no startup check.

## 5. A 91 MB model and branch divergence

**This repository has two diverged branches, and it matters for anyone reading
it.**

`main` (the branch this documentation describes) and `origin/main` share a base
commit and have since diverged. **Neither is an ancestor of the other**, so they
are two independent lines of work, not one ahead of the other.

| | Local `main` — documented here | `origin/main` |
| --- | --- | --- |
| Web app | `web/` — Next.js 15, 28 API routes, `node:sqlite` | Root-level `app/`, **Prisma** + migrations |
| Skill verification | 3 challenges / 30 minutes | Not present |
| Liveness | **None** | MiniFASNet / Silent-Face-Anti-Spoofing CNN |
| Gaze | MediaPipe `FaceLandmarker` | L2CS-Net, **91 MB** `.pkl` |
| Third-party code | None | Vendored `third_party/Silent-Face-Anti-Spoofing/` |
| Docs | This documentation set | `README.md`, `SETUP.md`, `DEMO_SCRIPT.md`, `AGENTS.md` |

**Consequences you should know about:**

1. **The ML files differ between branches** — `fusion.py`, `gaze.py`,
   `lipsync.py`, `service.py` and most of `resume_screening/` were modified on
   both sides. `origin/main` fuses **four** signals including liveness; `main`
   fuses **three**.
2. **`origin/main` commits a 91 MB model binary** (`L2CSNet_gaze360.pkl`), which
   is most of the repository's pack size. `.gitignore` has no rule for model
   files — it does not ignore `*.pkl`, `*.task` or `models/`.
3. **Merging the branches would conflict** on the ML files **and** would drop
   the entire older prototype (root `package.json`, root `app/`, `prisma/`,
   `third_party/`, `demo_clip.mp4`) on top of the current app. We did not attempt
   it.
4. **All documentation in this submission describes `main` only.** If you are
   reading `origin/main`, the architecture, the 3-challenge flow and the setup
   instructions here do not apply to it.

**The submission push went to `plit/main`** (which tracks `main`), not to
`origin/main`. See [../resource.md](../resource.md) and the commit message.

---

# Substantive

## 6. The ML services are deployed separately

PROV is **three processes**, not one.

| Port | Process | Language |
| --- | --- | --- |
| `3000` | Next.js web app + API | TypeScript |
| `8002` | Resume screening ML | Python |
| `8001` | Verification ML | Python |

**What this costs us:**

- **Three things to install, three things to start, three things to keep alive.**
  There is no single command and no single deployable.
- **Two runtimes** and two dependency trees. `npm install` and `pip install` can
  both fail independently.
- **ffmpeg must be on `PATH`** on whichever host runs `:8001`.
- **A `SyncNet` checkout must be supplied** on that host too (§3).
- **Network calls between processes.** `ML_TIMEOUT_MS` defaults to **5 minutes**
  because verification is CPU-bound. On a loaded machine a short video can take a
  long time, and the web request is held open for the duration.
- **Partial failure is a real state.** The web app runs fine with both ML
  services down; resume upload and shortlisting simply fail with `502` and a
  message naming the service.

**Why it is like this:** the web app must stay runnable with nothing but
`npm install`, and during a demo you want to be able to restart one service
without rebuilding the other. That is a deliberate trade of deployment
simplicity for demo resilience, documented in `web/lib/ml.ts`.

**What production would need:** a job queue for verification, container images
for both Python services, health-checked orchestration, and moving screening to
startup-time or cached model loading rather than per-request fitting.

## 7. Browser camera and microphone are required

The live clip verification flow needs `getUserMedia` — camera **and**
microphone — in the browser.

- **Permission is required and can be denied.** There is no fallback path and no
  graceful degradation beyond an error message. A candidate who declines cannot
  use that flow.
- **`localhost` is a secure context**, so it works in development. **Deployed
  over plain HTTP on a bare IP it will not** — the browser blocks `getUserMedia`
  outside a secure context. Production needs real HTTPS.
- **Recording format varies by browser.** The upload route accepts `.webm`,
  `.mp4`, `.mov`, `.mkv`, `.avi` up to 100 MB. Safari and Chrome produce
  different containers, and we have only tested what our own browsers produced.
- **Recording is held in memory and written to a temp file by the ML service.**
  A 100 MB clip is a real memory cost.
- **Headphones, echo cancellation and background noise** all affect the audio and
  lip-sync signals. There is no calibration step and no device check.
- **The three-challenge skill verification flow does *not* need a camera.** It is
  text-only. Only the live clip flow does. We have been careful to keep the two
  flows separate — see [architecture.md](architecture.md#two-distinct-verification-flows).

## 8. All demo data is synthetic

**Every name, email, company, role, resume, screening score and verification
signal in the seeded demo dataset is fabricated.** The fictional employer is
*NovaHire Technologies*.

| Element | Status |
| --- | --- |
| Candidate names, `@demo.local` emails, resumes | **Synthetic** |
| Screening scores in the seed | **Synthetic** — deterministic fixtures, not model output |
| Gaze / lip-sync / audio / liveness readings in the seed | **Synthetic constants** — not biometric measurements |
| Scoring arithmetic, ranking, token logic | **Real** |
| Shortlist scores after pressing *Run shortlist* | **Real** — `:8002` overwrites the fixtures |

Full disclosure in [ai.md §10](../ai.md#10-synthetic-and-demo-data).

**The limitation that matters:** the seed produces a *convincing* dataset, and a
convincing dataset can be mistaken for a tested one. We have labelled it in the
UI, in the API responses, in the seed's own stdout and throughout this
documentation — but the `demo_` id prefix is the only hard boundary between
fixture and reality, and a reviewer should check it.

**No real candidate has ever run a real verification session through PROV.**
There is no field data, no user study, and no evidence that the flows work for
anyone beyond the team.

## 9. ML false positives and false negatives

**We have no confusion matrix, no precision/recall figures and no F1 numbers for
any signal, and we are not going to invent any.**

`docs/anti-gaming-paper.md` §3 reserves a place for one and contains explicit
`TODO` placeholders. The evaluation harness that would produce them
(`ml/verification/evaluate.py`) exists, but its input — a labelled clip set,
`ml/verification/labels.json` — **does not exist in this repository.**

### Known failure modes

| Signal | False positive (honest candidate looks bad) | False negative (gaming looks fine) |
| --- | --- | --- |
| **Gaze** | Glasses, low light, screen reflections, a thinking pause, a second monitor, a candidate who reads their notes | A candidate who looks at a phone *and* narrates plausibly; an off-screen helper whose face is never in frame |
| **Lip-sync** | Heavy accent, low audio quality, background noise, a deliberate pause before answering | Playback at matched speed; a helper reading the answer aloud in sync |
| **Audio** | One speaker with an unusual voice, a cough, a cold, background music | A second voice in the same pitch range — the pitch-deviation proxy is explicitly not diarization |
| **Screening TF-IDF** | Rewards vocabulary overlap. A candidate who writes plainly scores lower than one who writes like a job description | A well-written resume for skills the candidate does not have |
| **Screening skills** | Misses a skill described only in context — "built a pipeline" never matches "ETL" | Keyword stuffing a resume with the exact required skills |
| **Curation** | A candidate whose real strength is not in the 15-challenge bank is under-measured | — |

### What we do about it

- **Fusion rather than per-signal thresholds**, so one weak signal can be
  overruled by two clean ones. This reduces false positives at the cost of some
  false negatives — the deliberate direction for a system that must not wrongly
  reject someone.
- **Every signal fails neutral at `0.5`**, never `0.0` or `1.0`. A detector that
  could not run is an unknown, not evidence.
- **A missing reading resolves to `REVIEW`**, because *"we have no reading"* is
  itself something a recruiter should see.
- **No automatic rejection anywhere.**

None of this makes the signals accurate. It makes them *safe to be wrong about*.

## 10. Thresholds are unvalidated engineering judgement

Every threshold in the system is a documented choice, not a measured one.

| Value | Where | Status |
| --- | --- | --- |
| `WEIGHTS = gaze 0.25, lipsync 0.40, audio 0.35` | `ml/verification/fusion.py` | Judgement. The source says *"Re-tune against your labeled set — don't ship these numbers as gospel."* |
| `PASS_THRESHOLD = 0.80`, `FAIL_THRESHOLD = 0.35` | `fusion.py` | Judgement |
| `any_signal_very_bad < 0.2` | `fusion.py` | Judgement |
| SyncNet `2.0` / `9.0` | `ml/verification/lipsync.py` | Source comment says **"NOT empirically validated"** |
| `OFF_SCREEN_RATIO_THRESHOLD = 0.35` | `ml/verification/gaze.py` | Judgement |
| `MIN_SEMITONE_GAP = 4.0`, `OVERLAP = 0.05` | `ml/verification/audio.py` | Judgement |
| `pass 1.2×`, `flagged/fail 0.5×` | `resume_screening/shortlist.py` | Judgement. No held-out study. |
| `0.7 skills / 0.3 TF-IDF` | `resume_screening/score.py` | Judgement |

**Nobody has measured whether these produce an acceptable false-positive rate.**
Anyone deploying this must re-tune them against a labelled set, and the
`evaluate.py` harness exists for exactly that purpose.

## 11. Behaviour is not competence

**The deepest limitation, and the one no threshold tuning fixes.**

Every integrity signal in PROV measures **behaviour**: where someone's eyes go,
whether their mouth matches the audio, whether a second pitch is present.
Behaviour is a *proxy* for competence and honesty, and a noisy one.

A candidate who will score poorly while behaving perfectly includes:

- anyone who is nervous on camera
- anyone with a disability affecting speech, gaze or facial movement
- anyone on a poor connection or in a noisy room
- anyone answering in their second language
- anyone who is neurodivergent and does not make conventional eye contact
- anyone with a second monitor, or who reads their notes, or who pauses to think

**A verification system that widens that gap is not measuring skill.** We built
the performance/integrity separation and the mandatory human review partly in
recognition of this. Those mitigate it. **They do not solve it**, and we do not
have an answer that does.

We would flag that a hiring product using these signals needs, at minimum:
published accuracy data per demographic group, an accommodation path, and a
candidate-facing appeal route. None of those exist here.

## 12. Liveness is not implemented

**There is no liveness signal in this codebase.** Stated plainly so nobody reads
it into the architecture:

- `ml/verification/liveness.py` **does not exist** on `main`.
- A repository-wide search for `liveness` in `ml/` returns **zero** matches.
- `fusion.py` fuses **three** signals. There is no `liveness` key in `WEIGHTS`.

Where the word *does* appear, and what it actually is:

| Location | What it really is |
| --- | --- |
| `web/lib/db.ts:283` | A **schema comment** listing permitted `integrity_events.signal` values: `gaze \| lipsync \| audio \| liveness \| session`. A reserved enum slot. |
| `web/app/api/health/route.ts:7` | The ordinary sense of "liveness" — *are the ML processes alive?* Unrelated. |
| `web/lib/demo-data.ts` | **Synthetic fixture constants** carrying the comment *"No liveness column exists; carried in rawSignals instead."* Fabricated, not measured. |

**A liveness implementation exists on the unmerged `origin/main` branch** (§5) —
a pretrained MiniFASNet / Silent-Face-Anti-Spoofing CNN with a four-signal
fusion (`gaze 0.15, lipsync 0.25, audio 0.20, liveness 0.40`). It depends on a
vendored third-party repository and a 91 MB model file, and it has never been
merged here. **We do not count it as a PROV capability.**

The schema is ready for it: adding liveness would mean a fourth weighted term in
`fusion.py` and a fifth `integrity_events.signal` value, with the same
neutral-`0.5`-on-failure discipline.

## 13. Challenge curation has a finite bank

**15 hand-written long-form challenges** across data/Python, psychology,
design/UX, HR/recruitment and software/general.

- **A candidate whose real strength is not represented is under-measured.** The
  general fallback (Problem Solving, Technical Communication, System Design
  Sketch) keeps the session *valid* but not *tailored*.
- **Coverage is narrow by design.** The bank is long-form written responses, so
  it suits roles where writing explains ability. It is a poor fit for roles
  where the real work is hands-on — a welder, a lab technician, a driver.
- **The alias table is a maintenance burden.** It maps "Recruitment" → Screening
  and "Statistics" → Statistical Interpretation. Every new skill label someone
  types needs an entry, or curation silently falls through to an unrelated
  domain.
- **The bank is not extensible at runtime.** Adding a challenge means editing
  `web/lib/challenges.ts`. There is no admin UI, no authoring tool, and no
  versioning.
- **Scoring is keyword-shaped.** Concept coverage matches substrings, so an
  answer using the right idea in entirely different words scores lower. This is
  the price of a scorer a candidate can audit, and we would make the same trade
  again — but it is a real weakness.

---

# Not built

## 14. Human review is a stub

`reviewedByHR` is a **boolean column**. That is a prototype-level answer to a
real problem.

**Not built:**

- A **reviewer queue** — nothing surfaces flagged sessions as work items.
- **Reviewer assignment** — no routing to a specific person.
- An **audit trail** — no record of who reviewed what, when, or on what basis.
- A **candidate-facing appeal path** — a candidate cannot see a flag, cannot
  respond to one, and cannot contest it.
- **Reviewer calibration** — nothing stops two recruiters treating the same
  signals differently, and nothing measures whether they agree.
- **Reviewer agreement metrics** — we cannot report inter-rater reliability,
  because we do not collect ratings from more than one person.
- **An outcome loop** — reviewer decisions do not feed back into threshold
  tuning, so the thresholds will never improve on their own.

The `REVIEW` / `FLAGGED` states and the mandatory-human-review rule are real and
enforced. The **process** around them is not built.

## 15. No authentication or authorisation

**Per the hackathon rules, the MVP has no authentication at all.**

- **Anyone can be any candidate.** Candidate id comes from `localStorage`. Pick
  a different id and you are that candidate.
- **Anyone can be the recruiter.** The role switcher is a client-side
  `localStorage` value and gates nothing. Every recruiter page is reachable.
- **There are no real accounts, no passwords, no sessions, no OAuth, no MFA, no
  password reset, no email verification.**
- **The role gate is explicitly not a security boundary.** `web/lib/session.ts`
  says it outright: *"presentation only. It never gates an API — every route
  already validates its own inputs."*

**What the routes *do* enforce** is ownership: a wrong-candidate probe on a
verification session returns the **same `404`** as an unknown id, so ids cannot
be confirmed by probing. That is resource-level isolation, not authentication.

Anyone could build a candidate record for someone else, apply on their behalf, or
read their stored answers. **This must not be deployed publicly as-is.**

## 16. Production and security

Not built, and not designed for:

| Area | Status |
| --- | --- |
| **HTTPS** | Required for `getUserMedia` outside `localhost`. Not configured. |
| **Secrets** | No secrets exist yet because there is no auth, no sessions and no third-party credentials. Adding any will need a real secret store — **nothing in this repo is a pattern for handling one.** |
| **Encryption at rest** | Resumes, written answers and integrity readings are stored in plaintext SQLite. |
| **Video retention** | Clips are written to a **temp directory** by the ML service and not cleaned up on a schedule. No retention policy, no deletion path, no consent flow. |
| **PII / GDPR** | No data-processing agreement, no retention schedule, no export or erasure endpoint, no DPIA. Candidate emails and resume text are stored indefinitely. |
| **Biometric data** | Gaze and audio *features* are derived, not raw biometrics, and the code is careful to say so. But a legal review of whether these derived signals are biometric data under GDPR has **not** happened**, and it should before deployment. |
| **Rate limiting** | None. Resume upload, token earn and verification submit are all unthrottled. |
| **CSRF** | No protection. The MVP has no cookies or sessions, so there is no session to ride, but this must be revisited the moment auth is added. |
| **Input validation** | Hand-rolled and per-route. No schema validation library, no request size limits on most JSON routes, no output encoding discipline beyond React's defaults. |
| **File upload safety** | Extension allowlists and size caps exist, but **no content-type sniffing, no antivirus scan, and no sandboxed parsing**. A malicious PDF is parsed by `pypdf` in-process. |
| **Audit log** | None, beyond the `integrity_events` table. |
| **Error handling** | Stack traces in development; no structured logging, no error tracking, no alerting. |
| **Backups** | None configured. |
| **Uptime** | `ML_TIMEOUT_MS` is 300 s and verification is CPU-bound. A short video can occupy a worker for a long time. There is no queue, no concurrency limit and no circuit breaker. |

**One good thing:** there are **no hardcoded secrets or credentials** anywhere in
this repository, because there is nothing to hardcode yet.

## 17. Scaling and performance

- **`node:sqlite` is a single-writer embedded database.** It is genuinely good
  for a demo and genuinely wrong for multiple app instances. SQLite in WAL mode
  allows concurrent readers but **one writer at a time**; two Next.js instances
  writing will eventually hit `SQLITE_BUSY`.
- **The database is a local file.** No network filesystem, no managed instance,
  no connection pooling, no replicas. It cannot be shared across hosts without
  becoming a locking problem.
- **The TF-IDF vectorizer is refit on every `/shortlist` call**, across the whole
  applicant pool. This is correct (scores are only meaningful relative to the
  pool) but it is **O(pool) work per request**. At a few hundred applicants it
  is fine; at tens of thousands it is not, and it would need incremental
  indexing.
- **No pagination** on the applications or candidates lists, and
  `/api/jobs/[id]/shortlist` returns every ranked applicant in one response.
  `token_transactions` history is paginated; most other list endpoints are not.
- **No caching** of screening results, and no memoisation of shortlist runs. A
  recruiter who re-runs a shortlist pays the full cost again.
- **No background jobs.** Resume parsing is synchronous inside the upload
  request; verification is synchronous inside the submit request. A 60-second
  verification holds an HTTP request open for 60 seconds.
- **No connection limits** on the two Python services. They will accept as many
  concurrent uvicorn workers as the machine allows, each loading a MediaPipe
  model into memory.
- **Assessment questions and the challenge bank are hardcoded** in TypeScript, so
  content changes are a code change and a deploy.

## 18. Other known gaps

- **`npm run seed` is broken** (§2).
- **`requirements.txt` is incomplete** (§1).
- **`start-demo.cmd` hardcodes one machine's ffmpeg path** and opens Windows-only
  consoles. There is no `.sh` equivalent.
- **`docs/anti-gaming-paper.md` contains `TODO` placeholders** where a confusion
  matrix and a ranking-formula reference should be, including a `TODO` to read
  the formula from `lib/ranking.ts` — **a file that does not exist**. We have
  left it as-is and flagged it rather than filling in invented numbers.
- **Two pre-existing docs are stale on lip-sync** (§3).
- **`web/measure.mjs` is a dev tool, not a test.** It drives a headless browser
  over CDP on port 9222 and is not covered by any script.
- **No CI.** Nothing runs `typecheck`, `lint`, `build` or the tests on commit.
  We ran them manually before this submission and recorded the results in
  [resource.md §6](../resource.md#6-hackmysuru-submission--declaration-checklist).
- **No accessibility audit**, no screen-reader testing, no keyboard-navigation
  review.
- **No i18n or timezone handling** beyond storing ISO-8601 UTC timestamps.
- **No browser matrix.** Tested on the browsers the team happened to use. The
  webcam flow in particular is untested outside Chromium-based browsers, and
  Safari's `MediaRecorder` output differs.
- **Candidate-facing copy has not been user-tested.** The integrity wording
  ("Worth a human look", "Flagged for review") is carefully chosen and
  **deliberately bland**, but nobody outside the team has read it and told us
  whether it lands.

---

## Summary for a reviewer

**What genuinely works:** the constraint work. Server-authoritative 30-minute
expiry, exactly-three-challenges as a database guarantee, the performance and
integrity separation, the no-auto-rejection rule, server-authoritative tokens,
answer keys that never reach the browser, and synthetic data that is labelled
everywhere. These are enforced in code, asserted in tests, and hold under
adversarial input.

**What is real but unmeasured:** the ML. Screening, gaze, lip-sync and audio all
run and return sensible outputs, but every threshold is engineering judgement and
**we have no accuracy data at all**.

**What is missing:** the human review process around a flag, authentication,
anything production-security-shaped, and a path to scale past a demo.

**What we would not claim:** that PROV detects cheating. It measures three
behavioural proxies, reports how unusual they were, and refuses to infer intent
from them. That inference belongs to a person who can also talk to the candidate.

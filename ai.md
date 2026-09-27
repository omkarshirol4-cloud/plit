# PROV — AI & ML Disclosure

An honest account of every model, algorithm and AI-assisted decision in PROV:
what is real, what is heuristic, what is not implemented at all, and what no
model is allowed to decide.

**The one-line version:** PROV uses two pretrained models and one in-memory
statistical transform. It trains nothing, fine-tunes nothing, and contains no
LLM. Every output is a number a recruiter can see the components of, and no
model output ever rejects a candidate on its own.

---

## Contents

1. [AI tools used during development](#1-ai-tools-used-during-development)
2. [Resume screening ML](#2-resume-screening-ml)
3. [Skill-based challenge curation](#3-skill-based-challenge-curation)
4. [Challenge scoring — explicitly not a model](#4-challenge-scoring--explicitly-not-a-model)
5. [Verification ML](#5-verification-ml)
   - [Gaze](#gaze)
   - [Lip-sync](#lip-sync)
   - [Audio](#audio)
   - [Liveness — not implemented](#liveness--not-implemented-on-this-branch)
   - [Fusion](#fusion)
6. [Integrity signal → product vocabulary](#6-integrity-signal--product-vocabulary)
7. [What AI does NOT decide](#7-what-ai-does-not-decide)
8. [Human review](#8-human-review)
9. [AI limitations](#9-ai-limitations)
10. [Synthetic and demo data](#10-synthetic-and-demo-data)

---

## 1. AI tools used during development

**This section is TBD and must be completed by the team before submission.**

We are not going to guess at this. What we can state factually about this
repository today:

- **No AI-generated artifact is committed to the product.** There is no
  generated code block, no vendored model output, and no synthetic "AI"
  feature dressed up as one.
- **There is no LLM anywhere in the running product.** No OpenAI/Anthropic/Gemini
  client, no prompt template, no model-gateway call, no inference endpoint. The
  only outbound HTTP from the web app is to our own two Python services on
  `:8001` and `:8002`.
- **No model-generated content reaches a candidate or a recruiter.** Every score,
  label, reason string and challenge is either computed by explicit arithmetic or
  authored by hand in a source file.

To complete: for each team member, list the AI coding assistants used, what
they were used for, and — importantly — **what was reviewed and rewritten by a
human before it shipped**. Please be specific. A vague "we used Copilot" is less
useful to a reviewer than an honest account of where it helped and where it did
not.

| Team member | AI tool(s) | Used for | Human review performed |
| --- | --- | --- | --- |
| Deeksha Ganiger | TBD | TBD | TBD |
| Trupti Iliger | TBD | TBD | TBD |
| Omkar Shirol | TBD | TBD | TBD |
| Joshua Endigeri | TBD | TBD | TBD |

> **Note for reviewers on repository history.** The remote `origin/main` branch
> contains an earlier prototype generation with different tooling conventions
> and a different web app layout. This document describes the code on the current
> `main`, which is the one with the `web/` application. See
> [docs/limitations.md](docs/limitations.md#5-a-91-mb-model-and-branch-divergence) for the full
> situation.

---

## 2. Resume screening ML

**Service:** `resume_screening/service.py`, FastAPI on `:8002`.
**Library:** scikit-learn. **Persisted model: none.**

### What it actually does

Given a job's `requiredSkills` and a pool of applicants, it returns a score and
a rank per applicant. Two components:

**a) Skill coverage — `skills_score`.** The fraction of `requiredSkills`
literally present in the resume text, matched case-insensitively **on word
boundaries**, with an alias table so equivalent labels match. The alias table
includes: `node.js`/`next.js`, `react`, `postgresql`←(`postgres`, `psql`),
`kubernetes`←(`k8s`), `aws`←(`amazon web services`), `machine learning`←(`ml`,
`deep learning`), `tensorflow`←(`tf`), `pytorch`←(`torch`),
`docker`←(`containerization`, `containers`), `ci/cd`←(`cicd`, `continuous
integration`, `continuous delivery`), `rest`←(`restful`, `restful api`).

**b) Text similarity — `tfidf_score`.** `TfidfVectorizer(stop_words="english",
ngram_range=(1,2), sublinear_tf=True, min_df=1)`, fit across the **whole
applicant pool** (never a single document in isolation, which would make the
score meaningless), cosine similarity of the query resume against its siblings,
then min-max rescaled to `[0,1]` across the observed band.

### The formula

```python
SKILL_WEIGHT = 0.7
TFIDF_WEIGHT = 0.3
combined = SKILL_WEIGHT * skills + TFIDF_WEIGHT * tfidf
```

Then multiplied by the verification multiplier:

| Verification result | Multiplier |
| --- | --- |
| `pass` | 1.2× |
| none (unverified) | 1.0× |
| `flagged` | 0.5× |
| `fail` | 0.5× |

> **Honest caveat on the multipliers.** `pass` → 1.2× and `flagged`/`fail` →
> 0.5× are **unvalidated engineering choices**, not empirically derived
> figures. There is no held-out study behind them in this repository. They are
> defensible as a product stance — verified work deserves a modest lift, an
> unverified session should not be silently rewarded, a flagged one should be
> discounted but **never zeroed**, because a flag is not a finding of
> misconduct. If we had a labelled dataset we would tune them. We do not, and we
> are not going to publish invented precision figures.

### Is it "trained"?

**No.** There is no training code, no persisted artifact, and no startup hook.
The vectorizer is constructed and fitted **in memory on every `/shortlist`
request** and then discarded. It is a statistical transform, not a trained
model, and we describe it that way.

Edge cases it handles honestly: fewer than two documents → all TF-IDF scores
`0.0` (similarity is undefined); an all-stopwords corpus → `ValueError` caught
and `0.0` returned rather than a 500.

### Resume text extraction

`resume_screening/extract_text.py`. PDF via `pypdf`, DOCX via stdlib `zipfile`
plus a regex pass over `word/document.xml` (with `<w:p>`→newline, `<w:tab/>`→tab,
`<w:br/>`→newline and XML entity unescaping), TXT/MD/RTF as UTF-8. Normalised
afterwards. Unsupported format or empty extraction raises `ValueError`, which
the service surfaces as `422`.

---

## 3. Skill-based challenge curation

**Location:** `web/lib/challenges.ts`. **Model: none. Network call: none. LLM:
none.**

This is a deliberate design decision, and the code says why in its own header: a
verification session has to be **defensible** and **reproducible**. If a
candidate asks "why these three questions?", the answer must be mechanical and
checkable. If a retake is to be comparable to the first attempt, the same
profile must yield the same paper. A model call satisfies neither.

### The bank

**15** hand-written long-form challenges across five domains:

| Domain | Challenges |
| --- | --- |
| Data / Python | Python, SQL, Data Interpretation |
| Psychology | Research Methodology, Case Analysis, Statistical Interpretation |
| Design / UX | UX Research, Interaction Design, Design Systems |
| HR / recruitment | Screening, Interviewing, People Operations |
| Software / general | Frontend, Problem Solving, System Design |

Each entry carries a `skill`, a `domains` list (which candidate profiles it
suits) and an `aliases` list. Aliases matter: without them, "Recruitment" would
never reach the Screening challenge and "Statistics" would never reach
Statistical Interpretation, and curation would quietly fall through to an
unrelated domain.

### The selection order

First match wins, until exactly 3 are chosen:

1. **Exact skill match** against the candidate's declared skills.
2. **Domain match** — the candidate's headline and resume text (first 4000
   chars) against the bank's `domains`.
3. **Declared skill order** — the candidate's own skill ordering.
4. **A fixed general fallback** — `Problem Solving`, `Technical Communication`,
   `System Design Sketch` — so a candidate with no skills still gets three real
   challenges instead of an error.

If the bank is exhausted, curation **throws** rather than returning a short
list. A two-challenge session is not a valid session.

### Reproducibility

Variation is a **pure function of the candidate id** via FNV-1a (offset basis
`2166136261`, prime `16777619`). Two candidates with identical skills get
different papers; the same candidate always gets the same paper, and it can be
recomputed from the session row. No randomness, no clock, no network.

### The rubric never leaves the server

`toPublic()` strips `rubric`, `domains` and `aliases`. The browser receives only
the question. This mirrors the assessment endpoints, which strip `answerIndex`.
The answer key must not reach the client.

---

## 4. Challenge scoring — explicitly not a model

We want to be blunt about this, because "AI scores the candidate" is an easy
claim to make and an untrue one to make here.

**Challenge scoring is a rubric match, not a model, and the UI says so.**

```typescript
// web/lib/challenges.ts
const hit = rubric.concepts.filter((c) => text.includes(norm(c)));
const coverage = rubric.concepts.length ? hit.length / rubric.concepts.length : 0;
const depth = Math.min(1, words / Math.max(rubric.minWords, 1));
const score = Math.round((coverage * 85 + depth * 15) * 10) / 10;
```

- **Concept coverage**, capped at **85** points — how many of the rubric's
  expected ideas the answer mentions.
- **Depth**, worth the remaining **15** — word count against the challenge's
  `minWords`.

Two deliberate choices:

- An answer under the minimum length is scored **0**, not a near-zero, so a
  recruiter reading the detail is not misled by a "3%".
- The score is computed **server-side, at submit time**, against a rubric the
  client never received. The client sends `candidateId` and `answer`. Nothing
  else.

The reasoning: *a verification score a candidate cannot audit is not much of a
verification.* This scorer is simple, fully inspectable, and reproducible. It
is not clever, and we would rather it be inspectable.

---

## 5. Verification ML

**Service:** `ml/verification/service.py`, FastAPI on `:8001`.

`POST /verify` takes a multipart clip, demuxes audio with ffmpeg, runs three
independent scorers, fuses them, and POSTs the result back to
`{BACKEND_BASE_URL}/api/verification-sessions`.

### Gaze

**Technique:** MediaPipe Tasks API `FaceLandmarker` — a 478-point face mesh
including iris landmarks (468–477), using the pretrained bundle at
`ml/verification/models/face_landmarker.task` (3.6 MB, committed to the repo).

**Method:** iris centre offset from the eye-corner midpoint, normalised by eye
width:

```
LEFT_IRIS  = [469, 470, 471, 472]      LEFT_EYE_CORNERS  = (33, 133)
RIGHT_IRIS = [474, 475, 476, 477]      RIGHT_EYE_CORNERS = (362, 263)
```

Frames are sampled every 3rd frame. A frame with no detected face counts as
off-screen. `OFF_SCREEN_RATIO_THRESHOLD = 0.35`.

**Scoring curve** — flat above 10% off-screen, then linear decay:

```python
if off_screen_ratio <= 0.10:
    score = 1.0 - off_screen_ratio          # 0.90 – 1.00
else:
    score = max(0.0, 0.90 - (off_screen_ratio - 0.10) * 1.8)
```

**Returns** `{score, off_screen_ratio, frames_scored}`.

**Trained by us:** no. Pretrained and bundled.

### Lip-sync

**Technique:** **SyncNet** (Chung & Zisserman), run as a subprocess against a
local `syncnet_python` checkout. Confidence is parsed from the subprocess output
with `Confidence:\s+([\d.]+)`; when multiple faces are tracked the **last**
match is taken.

**Status — read this before judging the signal.** The SyncNet checkout is
**not vendored into this repository**. It is gitignored, and it must be supplied
by the operator:

```bash
export SYNCNET_REPO_DIR=/path/to/syncnet_python
```

Without it, `score_lipsync()` raises `LipSyncError`, the caller catches it, and
the signal returns a **neutral `0.5` with a diagnostic note**. The pipeline
still runs, by design. A missing signal is reported as missing; it is never
silently turned into a pass or a fail.

**Thresholds — explicitly not empirically validated:**

```python
MIN_CONFIDENCE_FOR_ZERO_SCORE = 2.0   # rough "out of sync" floor cited in the literature
MAX_CONFIDENCE_FOR_FULL_SCORE = 9.0  # below the 10.081 observed on a clean known-good clip
```

Linearly rescaled between them. 300-second subprocess timeout.

> **Correction to our own older docs.** `README-ml-anti-gaming.md` and
> `docs/anti-gaming-paper.md` §2.1 both describe lip-sync as
> *"mouth-aspect-ratio vs audio-envelope correlation"*. That is **stale**. The
> implementation is SyncNet. We are flagging our own documentation drift rather
> than quietly leaving it, and we have not rewritten those pre-existing files as
> part of this submission.

### Audio

**Technique — and this is a heuristic, not a model.** Two stages:

1. **Voice activity detection** via `librosa.feature.rms` with a percentile
   threshold (`FRAME_LENGTH = 2048`, `HOP_LENGTH = 512`).
2. **Fundamental-frequency tracking** via `librosa.pyin` over C2–C7, then a
   rolling-median deviation (window 15) to detect frames whose pitch is far from
   the speaker's running median.

```python
MIN_SEMITONE_GAP_FOR_SECOND_VOICE = 4.0   # beyond one person's natural variation
MAX_ACCEPTABLE_OVERLAP_RATIO     = 0.05
```

**Scoring curve:** `ratio <= 0.05` → `1.0`; otherwise linear decay to 0 over a
further 0.25 of frames.

**Returns** `{score, second_voice_frame_ratio}`.

**Honest framing:** the code's own comment calls this *"a coarse proxy, not a
diarization system"*, and that is exactly right. It will miss a second voice
speaking in the same pitch range, and it will occasionally fire on a single
speaker with an unusual voice or a lot of background noise. It is a signal to
corroborate with others, not a verdict.

### Liveness is not implemented on this branch

**There is no liveness signal in this codebase.** We are stating this plainly
rather than quietly implying a four-signal pipeline.

Verified facts:

- `ml/verification/liveness.py` **does not exist** on the current `main`.
- A repository-wide search for `liveness` in `ml/` returns **zero** matches.
- `ml/verification/fusion.py` fuses **three** signals, not four. There is no
  `liveness` key in `WEIGHTS`, and `fuse()` takes three arguments.
- The only three places the word appears in `web/` are:
  1. `web/lib/db.ts:283` — a **schema comment** listing the permitted values for
     `integrity_events.signal`: `gaze | lipsync | audio | liveness | session`.
     It is a reserved enum slot, not a feature.
  2. `web/app/api/health/route.ts:7` — the word "liveness" in its ordinary
     sense of "is the process alive?", about the ML services. Unrelated.
  3. `web/lib/demo-data.ts` — **synthetic fixture values** for
     `livenessScore`, carrying the comment *"No liveness column exists; carried
     in rawSignals instead."* These are fabricated demo constants, not
     measurements. See [§10](#10-synthetic-and-demo-data).

**What does exist elsewhere.** A liveness implementation using a pretrained
MiniFASNet / Silent-Face-Anti-Spoofing CNN, with a four-signal fusion
(`gaze 0.15, lipsync 0.25, audio 0.20, liveness 0.40`), lives on a **separate
unmerged branch** (`origin/main`) that belongs to an earlier prototype
generation. It has never been merged into the code documented here, and it
depends on a vendored third-party repository and a 91 MB model file. We are not
counting it as a PROV capability.

**If liveness were added**, it would slot into `fusion.py` as a fourth weighted
term and into `integrity_events.signal` as a fifth signal value, with the same
neutral-`0.5`-on-failure discipline. The schema is already ready for it. The
model is not.

### Fusion

**Technique:** weighted linear combination. No model, nothing trained.

```python
WEIGHTS = {"gaze": 0.25, "lipsync": 0.4, "audio": 0.35}
PASS_THRESHOLD = 0.80
FAIL_THRESHOLD = 0.35
```

```python
fused = 0.25 * gaze + 0.40 * lipsync + 0.35 * audio

any_signal_very_bad = min(gaze, lipsync, audio) < 0.2

if   fused >= 0.80 and not any_signal_very_bad:  result = "pass"
elif fused <  0.35 and     any_signal_very_bad:  result = "fail"
else:                                           result = "flagged"
```

`reviewed_by_hr` is `True` for everything except a clean `pass`.

**Why the weights are what they are** (from the source comment): audio and
lip-sync — someone else answering — are stronger, harder-to-fake-innocently
signals than gaze, which legitimately varies a lot. Note-glancing, thinking
pauses and screen reflections all confuse iris tracking.

**Why fusion rather than per-signal thresholds** — the core anti-gaming
argument: a candidate who glances off-screen once but has clean lip-sync and
audio is almost certainly fine, and thresholding gaze alone would
false-positive them. Conversely, perfect gaze with an audible second voice is
clearly gaming even though gaze alone looks clean. Fusion lets one weak signal
be overruled by two clean ones, and two bad signals overrule one clean one.

> **These weights and thresholds are engineering judgement, not validated
> results.** The source comment says so itself: *"Re-tune against your labeled
> set — don't ship these numbers as gospel."* We have no labelled evaluation set
> in this repository. `ml/verification/evaluate.py` is a precision/recall/F1
> harness that would do this analysis, and `ml/verification/labels.json` — the
> data it consumes — **does not exist**. See
> [docs/limitations.md](docs/limitations.md).

**Every signal can fail neutral.** If a signal cannot be computed it returns
`0.5` with a diagnostic note, never `0.0` or `1.0`. A failed detector is an
unknown, not evidence.

---

## 6. Integrity signal → product vocabulary

The ML layer's `pass` / `flagged` / `fail` is an internal diagnostic. What a
recruiter sees is deliberately different wording (`web/lib/challenges.ts`):

| ML result | Product integrity status | Recruiter-facing label | Meaning |
| --- | --- | --- | --- |
| `pass` | `normal` | Signals normal | The signals collected came back in the expected range |
| `flagged` | `review` | Worth a human look | One or more signals outside the expected range |
| `fail` | `flagged` | Flagged for review | A stronger prompt for a human to look |
| *no signal at all* | `review` | Worth a human look | **"We have no reading" is itself something a recruiter should see** |

**The vocabulary change is the entire point.** The ML layer's own docstring is
explicit that `fail` means *"route to a human with suspicion"*, never *"this
person cheated"*. The platform never renders the word "cheating" or "cheat" —
and there is a test that asserts it.

`verification-flow-test.ts` includes a vocabulary check that scans the entire
session payload for the substrings `"cheat"` and `"cheating"` and fails if
either appears. We built a test for our own wording, because wording is a
safety mechanism and safety mechanisms should be tested.

### Performance and integrity are separate axes

```typescript
// web/lib/finalizeIfComplete — the separation, in four lines
const integrity: IntegrityStatus = rolled ?? "review";
const overall: number = overallPerformance(scores);
const finalResult: FinalResult = integrity === "normal" ? "verified" : "review_required";
```

**Integrity never enters the score calculation.** A session with three perfect
scores and a flagged integrity event is `REVIEW_REQUIRED`. A session with three
poor scores and clean integrity is still `VERIFIED`. Both facts are shown to the
recruiter, side by side, and a human decides.

A session that finished with **no integrity events at all** resolves to
`review` — because "we have no integrity reading" is a fact the recruiter needs,
not a gap to paper over.

The recruiter view renders *Challenge performance* and *Integrity signals* as
two independent large figures and never combines them, with the reasoning stated
in the code: *"a single blended score would hide exactly the case that
matters."*

---

## 7. What AI does NOT decide

This is the section we care most about getting right.

| Decision | Who makes it | Enforced by |
| --- | --- | --- |
| **Whether a candidate is disqualified** | **A human. Always.** | There is no auto-rejection code path anywhere in the repository. `REVIEW` and `FLAGGED` both route to a person. |
| **Whether a session counts as verified** | **A human reviewer**, on the recruiter's side | `finalResult` is a *routing* label, not an outcome. `verified` means "signals normal", not "approved". |
| **Challenge scores** | Deterministic rubric arithmetic, server-side | `scoreAnswer()` — no model, no client input |
| **Session timing** | The server clock | `startedAt`/`expiresAt` written once; `enforceExpiry()` on every read and write |
| **Which three challenges** | Deterministic curation, seeded by candidate id | `curateChallenges()` — reproducible and inspectable |
| **The answer key** | Hand-authored, and never sent to the browser | `PublicChallenge` omits `rubric`; `PublicAssessment` omits `answerIndex` |
| **Token amounts** | The server, re-derived from real tables on every earn | The earn endpoint accepts no `amount`; sending one returns `400 AMOUNT_NOT_ACCEPTED` |
| **Which jobs a candidate is shown** | Application state, not engagement | `recommendedJobs` is "open jobs not yet applied to" |
| **Anything about a candidate's character, intent or honesty** | **Nothing. No model in PROV attempts this.** | Our signals are behavioural proxies, and they are treated as prompts, not conclusions |

**Explicitly: PROV does not detect "cheating".** It measures gaze patterns,
mouth-audio alignment and pitch overlap, and reports how unusual they were. The
inference from "unusual" to "dishonest" is a judgement about a person, and PROV
refuses to make it. That inference belongs to a person who can also talk to the
candidate.

**Tokens never influence hiring.** They are an engagement reward, explicitly not
redeemable for anything, and they are absent from recruiter views and from every
ranking formula. Engagement is not merit.

---

## 8. Human review

Human review is not a fallback path in PROV. It is the **only** path.

1. **Every non-clean integrity outcome sets `reviewedByHR = True`** at the fusion
   layer — `flagged` and `fail` both, always.
2. **`fail` is a stronger prompt, not a verdict.** The ML source comment is
   direct: *"Strong multi-signal or single very-bad-signal case. Still not an
   auto-reject — just a stronger recommendation to the human."*
3. **The product renames the outcomes** so the UI cannot imply a finding of
   misconduct. A recruiter sees *Worth a human look* or *Flagged for review*.
4. **Both `review` and `flagged` display the label "Review required"** in the
   roll-up. The system does not distinguish "probably fine" from "probably not"
   on its own authority.
5. **The recruiter view says it in plain text**, next to the numbers: *"A
   recruiter decides, not the system."*
6. **A missing reading is a reason to review**, not a reason to pass. A session
   with no integrity events at all finalises as `review`.

**What we have not built, and would need to before this is a real hiring
product:** a reviewer queue, reviewer assignment, an audit trail of who
reviewed what and when, a candidate-facing appeal path, reviewer calibration
between recruiters, and any measurement of reviewer agreement. The `reviewedByHR`
column is a boolean. That is a prototype-level answer to a real problem, and we
would rather name it than imply it is solved.

---

## 9. AI limitations

### False positives and false negatives are real and unquantified

**We have no confusion matrix, no precision/recall figures and no F1 numbers for
any signal in this repository, and we are not going to invent any.**

`docs/anti-gaming-paper.md` §3 reserves a place for a confusion matrix and
contains explicit `TODO` placeholders. We are flagging that file as incomplete
in [README.md](README.md) rather than quietly leaving plausible-looking numbers
in place. The evaluation harness that would produce them
(`ml/verification/evaluate.py`, a precision/recall/F1 runner) exists, but its
input — a labelled clip set (`ml/verification/labels.json`) — **does not**.

### Specific, known failure modes

| Signal | How it goes wrong |
| --- | --- |
| **Gaze** | Glasses, poor lighting and screen reflections all corrupt iris tracking. A candidate thinking, reading notes, or looking at a second monitor scores badly while behaving entirely honestly. Lowlighting makes face detection fail entirely, and a frame with no face counts as off-screen. |
| **Lip-sync** | Degrades with heavy accent, low audio quality, background noise, or a candidate who pauses to think before answering. Requires an external model checkout; without it the signal is absent, not neutral-by-design-but-present. |
| **Audio** | The pitch-deviation proxy misses a second voice in the same pitch range, and can fire on one speaker with an unusual voice, a cold, or a cough. Explicitly not diarization. |
| **Screening TF-IDF** | Similarity between resumes is a weak proxy for capability. It rewards vocabulary overlap. A candidate who writes plainly scores lower than one who writes like a job description. |
| **Screening skills** | Word-boundary matching misses a skill described only in context — "built a pipeline" never matches "ETL". The alias table mitigates this but cannot eliminate it. |
| **Curation** | A candidate whose real strength is not in the 15-challenge bank is under-measured. The general fallback keeps the session valid, but it is not tailored. |
| **Fusion** | A weighted sum cannot represent "gaze is uninformative here". A confidently-wrong signal drags the fused score in a way no reviewer can see. |

### The deepest limitation

**Every one of these signals measures behaviour, and behaviour is not
competence.** A nervous candidate, a candidate with a disability, a candidate
on a poor connection, or a candidate answering in their second language will
score worse than an equally capable candidate who is comfortable on camera. A
verification system that widens that gap is not measuring skill, and no
threshold tuning fixes it.

We built the separation rule and the human-review requirement partly in
recognition of this. They mitigate it. They do not solve it.

---

## 10. Synthetic and demo data

**Everything below is fabricated. None of it came from a camera, a microphone,
a resume, or a model.**

### The dataset

Seeded by `cd web && npm run seed:demo`, defined in `web/lib/demo-data.ts` and
written by `web/lib/demo-seed.ts`.

- **Employer:** *NovaHire Technologies* — a fictional company. The stored
  tagline reads: **"SYNTHETIC DEMO EMPLOYER — fictional company, fictional
  roles."**
- **Recruiter:** *Aarav Mehta* `<recruiter@novahire.demo>` — fictional.
- **10 candidates** with fabricated names, `@demo.local` email addresses, and
  hand-written multi-line resume texts describing jobs that never happened.
- **5 open roles**, **33 applications**, **7 verification records**,
  **5 skill-verification sessions**, **11 assessments**, **34 achievements**,
  **108 token transactions**.

### What is real and what is not

| Element | Real or synthetic |
| --- | --- |
| Candidate names, emails, companies, roles, resumes | **Synthetic** |
| Screening scores in the seed | **Synthetic.** Deterministic fixtures written by the seed, labelled in the UI as *"demo seed values (demo_seed_2026), not ML output"*. `estimateDemoScore()` is explicitly headed *"DEMO SCORE ESTIMATOR — NOT THE ML MODEL"*. |
| Verification gaze / lip-sync / audio / liveness readings in the seed | **Synthetic constants.** Labelled *"No camera, microphone or verification model produced them, and none of it is biometric data."* |
| The scoring arithmetic, ranking and token logic | **Real.** The same `curateChallenges()` / `scoreAnswer()` / token modules the running product uses. |
| Shortlist scores after you press *Run shortlist* | **Real.** The ML service on `:8002` overwrites the fixtures. |

### How it is labelled

- Every seeded row carries a **`demo_` id prefix** (`demo_cand_`, `demo_job_`,
  `demo_app_`, `demo_vs_`, `demo_svs_`).
- Candidate emails use the reserved `.demo`/`.local` style, and recruiter-facing
  screens show a **"synthetic demo"** badge and an explanatory notice.
- `npm run reset:demo` deletes rows by `id GLOB 'demo_*'` — `GLOB`, not `LIKE`,
  because in `LIKE` an underscore is a single-character wildcard. It then
  asserts that **zero** non-demo rows were deleted, and exits non-zero if any
  were.
- The demo badge is driven by `web/lib/demo-marker.ts`, a **zero-import**
  client-safe module, so a synthetic row can never be mislabelled by a bundling
  accident.

### One deliberate omission

**The seed does not hand-pick achievement unlocks.** Achievements are evaluated
by the real `evaluateAchievements()` against real progress rules. The reason,
from the source: *"Hand-picking unlocks would be the fastest way to ship an
impossible state (a 'Verified' badge on a candidate with no passing session)."*

A seeded row is otherwise indistinguishable from one the running product
created. That is deliberate — a demo should not lie about how the system works
— but it does mean the `demo_` prefix is the *only* thing separating fixture
from reality, and reviewers should check it.

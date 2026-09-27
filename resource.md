# PROV — Submission Resource Pack

Everything a HackMysuru reviewer needs in one place: who we are, what is
built and running, how to see it in three minutes, and the submission
checklist.

**Anything we do not yet have is marked `TBD`.** We have not invented any links,
credentials, metrics or dates.

---

## 1. Team

| Name | Role | GitHub | Email | LinkedIn |
| --- | --- | --- | --- | --- |
| Deeksha Ganiger | Team Leader | TBD | TBD | TBD |
| Trupti Iliger | Team Member | TBD | TBD | TBD |
| Omkar Shirol | Team Member | TBD | TBD | TBD |
| Joshua Endigeri | Team Member | TBD | TBD | TBD |

**Per-member contribution split: TBD.** We would rather leave this blank than
guess at it. Each member's specific commits and areas of ownership are TBD and
will be filled in before final submission.

**Team contact for reviewer questions:** TBD

---

## 2. What we built

PROV is a working full-stack hiring platform, not a mockup. Every screen and
every endpoint described below is implemented and runs from this repository.

### 2.1 The product

A hiring platform where a candidate's claimed skill is replaced by (a) a short,
timed, skill-specific work sample and (b) integrity signals that are kept
**deliberately separate** from how well they scored.

**ML resume screening.** Applicants are ranked against a job's required skills
using `0.7 × skill coverage + 0.3 × TF-IDF similarity`, then multiplied by a
verification multiplier (`pass` → 1.2×, unverified → 1.0×, `flagged`/`fail` →
0.5×). The recruiter sees the component breakdown, not just a total.

**Deterministic challenge curation.** A verification session draws **exactly
three** challenges from a hand-authored bank of **15**, matched to the
candidate's declared skills and profile text. Selection is a pure function of
the candidate id (FNV-1a seeded), so it is reproducible and a recruiter can
always answer *"why these three?"*

**A 30-minute, server-authoritative session.** `startedAt` and `expiresAt` are
written once from the server clock. Expiry is enforced at the top of every read
and every write, so it does not depend on a timer in any process. A refresh
resumes the same session instead of restarting the clock, and a wrong-candidate
probe gets the same `404` as an unknown session id.

**Verification ML.** Gaze (MediaPipe `FaceLandmarker` iris offset), lip-sync
(SyncNet) and audio (librosa voice-activity + pitch deviation) are fused into
`pass` / `flagged` / `fail`, then mapped to product vocabulary `NORMAL` /
`REVIEW` / `FLAGGED`. See [ai.md](ai.md) for full detail.

**The separation rule.** Challenge performance and integrity live in different
columns and are rendered as two independent figures. Nothing in the schema or
the code lets one overwrite the other. A perfect score with a flag is a
representable, honest state — not something to average away.

**Supporting surface.** Candidate profiles with resume upload and parsing,
job posting and applications, multiple-choice assessments with server-side
grading, achievements, and a token economy that rewards activity and is
**never** shown to recruiters and **never** enters a hiring score.

### 2.2 Engineering substance

The parts we would point a reviewer at first, because they are where the
constraint work actually lives:

| Property | How it is enforced | Where |
| --- | --- | --- |
| Exactly 3 challenges, no duplicates | `UNIQUE(sessionId, challengeNumber)` — a database guarantee, not a convention | `web/lib/db.ts` |
| 30 minutes is real | `enforceExpiry()` on every read *and* write; `409 SESSION_EXPIRED` after the deadline | `web/lib/skill-verification.ts` |
| A submitted answer cannot be edited | `UNIQUE(sessionId, challengeId)`; concurrent double-submit caught by constraint-violation matching | `web/lib/skill-verification.ts` |
| The client cannot forge a score | `scoreAnswer()` runs server-side against a rubric the client never receives | `web/lib/challenges.ts` |
| The client cannot forge a time | The client sends only `candidateId` and `answer` | `web/lib/skill-verification.ts` |
| The client cannot forge tokens | The earn endpoint takes **no** `amount`; it re-derives every reward from real tables, and `amount` is rejected with `400 AMOUNT_NOT_ACCEPTED` | `web/lib/tokens.ts` |
| No double rewards | `UNIQUE(candidateId, type, referenceId)` on the ledger | `web/lib/db.ts` |
| The answer key never reaches the browser | `PublicChallenge` omits `rubric`; `PublicAssessment` omits `answerIndex` | `web/lib/challenges.ts`, `web/lib/assessments.ts` |
| No auto-rejection | `REVIEW` and `FLAGGED` both mean "a human should look" | everywhere |
| Tokens never affect hiring | Tokens are absent from recruiter views and from every ranking formula | `web/app/recruiter/**` |

### 2.3 Scale of the codebase

- **28** API routes (`web/app/api/**/route.ts`)
- **25** pages — 15 candidate, 7 recruiter, 3 root (`/`, `/about`, `/how-it-works`)
- **15** runtime npm dependencies' worth of features on **3** runtime
  dependencies (`next`, `react`, `react-dom`) — the database is a Node builtin
- **15** hand-written challenges; **15** labelled steps / **72** assertions in the
  verification flow test; **9** token reward rules; **6** achievements;
  **3** seed assessments
- **2** Python ML services, **3** processes total

---

## 3. Live MVP details

| Item | Value |
| --- | --- |
| Live URL | **TBD** — not yet deployed |
| Local URL | `http://localhost:3000` |
| Repository URL | **TBD** — to be confirmed at submission |
| Tech stack | Next.js 15.5 (App Router), React 19, TypeScript 5.7, `node:sqlite`, Python FastAPI, scikit-learn, MediaPipe, SyncNet, librosa |
| Services | Next.js `:3000` · verification ML `:8001` · resume screening ML `:8002` |
| One-command start (Windows) | `start-demo.cmd` |
| Seed command | `cd web && npm run seed:demo` |
| Reset command | `cd web && npm run reset:demo` |
| Health check | `GET /api/health` — reports row counts and both ML service statuses |
| Type check | `cd web && npm run typecheck` |
| Build | `cd web && npm run build` |
| Tests | `cd web && npm test` · `npm run test:e2e` (needs all three services) |

**Demo dataset (synthetic).** Seeded by `npm run seed:demo`:

- Fictional employer **NovaHire Technologies** — *"SYNTHETIC DEMO EMPLOYER —
  fictional company, fictional roles."* Demo recruiter: **Aarav Mehta**.
- **5** open roles, **10** candidates, **33** applications, **7** verification
  records, **5** skill-verification sessions (3 challenges each), **11**
  assessments, **34** achievements, **108** token transactions.
- Deliberately *not* an all-against-all matrix. A real pipeline has uneven
  coverage, and the sparse rows are what make the recruiter's "awaiting
  screening" and "not shortlisted" views meaningful.
- All rows carry a `demo_` id prefix, are labelled in the UI, and
  `npm run reset:demo` deletes only `demo_*` rows while verifying that no
  real row was touched.

> **Every name, email, resume, screening score and verification signal in the
> demo dataset is synthetic.** The screening scores are deterministic fixtures,
> not ML output; the verification signals are constants, not biometric
> measurements. The scoring arithmetic, ranking and token logic around them are
> real. See [ai.md](ai.md#10-synthetic-and-demo-data).

---

## 4. The 3-minute reviewer path

This is the fastest honest path from a cold clone to seeing the thing work.
Full setup detail is in [docs/setup.md](docs/setup.md).

### Before the demo (once, ~5 min)

```bash
pip install -r requirements.txt scikit-learn pypdf
cd web && npm install && npm run seed:demo
```

Then `start-demo.cmd` (Windows) or the three commands in
[docs/setup.md](docs/setup.md#6-run-the-three-services), and open <http://localhost:3000>.

### Minute 0:00 – 0:30 · Prove the stack is real

Open **<http://localhost:3000/api/health>**. You should see `"ok": true`, row
counts, and `"verification"` / `"screening"` both reporting `ok`. If a service
is down it says `"unreachable (...)"` by name.

### Minute 0:30 – 1:30 · Candidate: run a real verification session

1. Land on `/`, choose the **Candidate** role, open **Profile** and pick any
   demo candidate (or create a new one with skills).
2. Go to **Skill verification** → **Start 30-minute verification**.
3. Note the countdown. It was computed from the server clock.
4. Answer all three challenges. Each is specific to a declared skill.
5. Submit all three → the result panel shows **challenge performance** and
   **integrity** as two separate numbers.

**Refreshing the page is the best 10-second demo in the whole product.** The
session resumes with the *same* deadline and the same unsubmitted challenges —
a refresh does not hand you 30 more minutes. Try it.

### Minute 1:30 – 2:30 · Recruiter: screening and the two-axis view

1. Switch to the **Recruiter** role → **Jobs**.
2. Open *Junior Data Analyst* → **Run shortlist**. This calls the real ML
   service on `:8002`. The ranked table shows the score breakdown and matched /
   missing skills.
3. Open any applicant. Scroll to **Skill verification**.
4. **This is the money shot:** *Challenge performance* and *Integrity signals*
   sit side by side as two independent figures, with a per-challenge table and
   a per-signal integrity event table underneath. The footer states that tokens
   are not shown because they play no part in ranking.

### Minute 2:30 – 3:00 · Show the guarantees, not the claims

Run these and let the output speak:

```bash
cd web && npm run test:verification   # 72 assertions: expiry, isolation, immutability
```

Worth calling out from that output:

- **Server-authoritative expiry** — the test backdates `expiresAt` to simulate
  30 minutes passing, because an HTTP test can only assert that a timer was
  *asked* for, not that it is *enforced*.
- **Cross-candidate isolation** — a wrong-candidate probe gets the same `404`
  as an unknown id.
- **The vocabulary test** — it asserts the strings `"cheat"` / `"cheating"`
  appear nowhere in the session payload. We built a test for our own wording.

If you want to show the ML for real, record a short webcam clip at
`/candidate/verification` and submit it; `:8001` scores it and posts the
result back. Note the diagnostics: if `SYNCNET_REPO_DIR` is unset, lip-sync
returns a neutral `0.5` and *says so*. That honesty is the point.

---

## 5. Submission materials

| Material | Link | Status |
| --- | --- | --- |
| Pitch / code walkthrough video | TBD | TBD |
| Decision log (PDF) | TBD | TBD |
| Presentation slides (PDF) | TBD | TBD |
| Live deployment URL | TBD | TBD |
| Repository URL | TBD | TBD |
| Screenshots | [`docs/images/`](docs/images/README.md) | To be captured — see the list in that file |

> We have deliberately left these as `TBD` rather than guessing. None of them
> exist yet, and a submission with a dead link is worse than one that admits it
> is pending.

**Suggested scope for the decision log** (for whoever writes it): the
performance-vs-integrity separation, why the client is never trusted with a
timestamp or a score, why challenge curation is deterministic rather than
model-generated, and why every signal can fail neutral.

---

## 6. HackMysuru submission & declaration checklist

### Repository and documentation

- [x] `README.md` — overview, problem, users, solution, both flows, stack, AI/ML,
      architecture, setup, limitations, team
- [x] `resource.md` — this file
- [x] `ai.md` — AI tooling, ML techniques, honest limitations, human review,
      what AI does not decide, synthetic data disclosure
- [x] `docs/architecture.md` — real architecture, real paths, component diagram
- [x] `docs/constraints.md` — the constraints the build holds to
- [x] `docs/setup.md` — exact setup, run, seed, reset, test, build
- [x] `docs/limitations.md` — what this prototype cannot do
- [x] `docs/images/` — screenshot list (to be captured; **no fabricated
      screenshots**)
- [x] Every internal documentation link resolves to a file that exists
- [x] No dead or invented external links

### Honesty and disclosure

- [x] Demo data is labelled synthetic in the UI *and* in the docs
- [x] No fabricated screenshots
- [x] No invented metrics, precision/recall figures, or accuracy claims —
      `docs/anti-gaming-paper.md` still carries explicit `TODO` placeholders for
      its confusion matrix and is flagged as such in [README.md](README.md)
- [x] AI usage during development disclosed in [ai.md](ai.md)
- [x] What the AI does **not** decide is stated explicitly
- [x] Thresholds documented as engineering choices, not validated results
- [x] Known gaps (missing `scikit-learn`/`pypdf` in `requirements.txt`, lip-sync
      checkout not vendored) recorded rather than hidden

### Application integrity

- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] `npm run test:verification` passes
- [x] `npm test` passes (with services running)
- [x] `npm run test:e2e` passes (with all three services running)
- [x] `python -m resume_screening.selftest` passes
- [x] No application code was changed to produce this documentation
- [x] `git status` is clean after commit

### Still to do before submitting — `TBD`

- [ ] Capture the screenshots listed in [`docs/images/README.md`](docs/images/README.md)
- [ ] Record the pitch / code walkthrough video and paste the link above
- [ ] Produce the decision log PDF and paste the link above
- [ ] Produce the presentation PDF and paste the link above
- [ ] Deploy and record the live URL
- [ ] Confirm the repository URL is public
- [ ] Fill in the team table (GitHub, email, LinkedIn) and the contribution split
- [ ] Re-run the full test suite against the deployed instance

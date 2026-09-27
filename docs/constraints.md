# PROV — Constraints

The constraints PROV is built to hold to. Each one is a product commitment, and
each is enforced somewhere specific in the code rather than merely intended.

These are not aspirational. Every entry below names the file and the mechanism
that makes it true, and most of them are covered by an assertion in
`web/scripts/verification-flow-test.ts`.

---

## Contents

1. [Exactly three skill-specific challenges](#1-exactly-three-skill-specific-challenges)
2. [A 30-minute verification window](#2-a-30-minute-verification-window)
3. [Server-authoritative expiry](#3-server-authoritative-expiry)
4. [Performance is not integrity](#4-performance-is-not-integrity)
5. [REVIEW and FLAGGED require a human, never an accusation](#5-review-and-flagged-require-a-human-never-an-accusation)
6. [Token security](#6-token-security)
7. [No tokens in hiring scores](#7-no-tokens-in-hiring-scores)
8. [Synthetic demo data is labelled](#8-synthetic-demo-data-is-labelled)
9. [The ML services remain intact](#9-the-ml-services-remain-intact)
10. [Supporting constraints](#10-supporting-constraints)

---

## 1. Exactly three skill-specific challenges

**The constraint.** A verification session contains exactly three challenges.
No fewer, no more, no duplicates, and each one relevant to the candidate's
declared skills.

**Why it matters.** A variable-length test is not comparable across candidates,
and an unscoped test measures general ability rather than the skill being hired
for.

**How it is enforced — at the database level:**

```sql
-- web/lib/db.ts
CREATE TABLE verification_challenges (
  ...
  challengeNumber INTEGER NOT NULL,
  UNIQUE (sessionId, challengeNumber)
);
```

The `UNIQUE` constraint is what makes "exactly 3, no duplicates" a **database
guarantee rather than an application convention**. The source comment is
explicit about that framing.

`startSession()` additionally refuses to create a short session:

```typescript
if (picked.length !== CHALLENGE_COUNT) {
  fail(`expected ${CHALLENGE_COUNT} challenges, curated ${picked.length}`, 500, "CURATION_FAILED");
}
```

And `curateChallenges()` **throws** rather than returning a short list if the
bank is exhausted. A two-challenge session is not a valid session.

**Skill-specific, not random.** Selection is a four-tier deterministic cascade
(`web/lib/challenges.ts`), first match wins:

1. Exact skill match against the candidate's declared skills
2. Domain match — headline and resume text against the bank's `domains`
3. The candidate's skills in their declared order
4. A fixed general fallback, so a candidate with **no** skills still gets three
   real challenges instead of an error

The bank is **15** hand-written long-form challenges across data/Python,
psychology, design/UX, HR/recruitment and software/general. Aliases matter:
without them, "Recruitment" would never reach the Screening challenge.

**Reproducible.** Variation is a pure function of the candidate id via FNV-1a.
Two candidates with identical skills get different papers; the same candidate
always gets the same paper, recomputable from the session row. No randomness, no
clock, no network, **no LLM**.

**No model call, deliberately.** A verification session must be *defensible* —
"why these three?" needs a mechanical answer a recruiter can check — and a
retake must be *comparable*. A model call satisfies neither.

**Tested:** `verification-flow-test.ts` asserts exactly 3, no repeated skill, and
per-profile challenge titles.

---

## 2. A 30-minute verification window

**The constraint.** A session runs for 30 minutes. The client never influences
the duration.

**Why it matters.** An unbounded work sample measures the ability to search the
internet for eight hours, not the ability to do the job.

**How it is enforced:**

```typescript
// web/lib/challenges.ts
export const SESSION_MINUTES = 30;   // "Server-owned; the client never sends this."
```

```typescript
// web/lib/skill-verification.ts - startSession()
const startedAt = opts.now ?? nowIso();
const expiresAt = new Date(new Date(startedAt).getTime() + SESSION_MINUTES * 60_000).toISOString();
```

Both timestamps are written **once**, at start, from the server clock. The client
sends neither.

**Refresh does not restart the clock.** `startSession()` *resumes* a live
session for the same candidate rather than minting a new one:

```typescript
const live = db.prepare(
  `SELECT id FROM skill_verification_sessions
    WHERE candidateId = ? AND status = 'in_progress' AND expiresAt > ? ...`
).get(candidateId, nowIso());
if (live) return getSession(live.id, candidateId);
```

The source comment: *"because 'start' is reachable more than once and a refresh
must not restart the clock."*

**Tested:** the flow test asserts the 30-minute window is set, and separately
that a resume does not reset it.

---

## 3. Server-authoritative expiry

**The constraint.** Expiry is enforced by the server on every operation. No
client-side timer is trusted, and no client state can extend a session.

**Why it matters.** A countdown rendered in the browser is a suggestion. If
expiry depends on it, the constraint is decorative.

**How it is enforced — on every read and every write:**

```typescript
// web/lib/skill-verification.ts
export function enforceExpiry(sessionId: string): void {
  db.prepare(
    `UPDATE skill_verification_sessions
        SET status = 'expired',
            finalResult = CASE WHEN finalResult = 'pending' THEN 'incomplete' ELSE finalResult END
      WHERE id = ? AND status = 'in_progress' AND expiresAt <= ?`
  ).run(sessionId, nowIso());
}
```

`enforceExpiry()` is called at the top of `loadSessionRow()`, which is the entry
point to `getSession()`, `submitChallenge()` and `recordIntegrityEvent()`. So it
runs on **every** read and **every** write.

**It does not depend on a timer in any process.** The source comment: *"so
expiry does not depend on a timer firing in any particular process."* A suspended
laptop, a killed server or a restarted process cannot leave a stale
`in_progress` row.

**A late answer is rejected outright:**

```typescript
function assertLive(session: Row): void {
  if (String(session.status) === "expired") {
    fail("this verification session has expired and no longer accepts answers", 409, "SESSION_EXPIRED");
  }
  if (String(session.status) === "completed") {
    fail("this verification session is already complete", 409, "SESSION_COMPLETE");
  }
}
```

**The UI countdown is derived from the server, not trusted:**

`SessionView` carries `serverNow` and `remainingSeconds`, both server-computed.
The component ticks locally from a `syncedAt` ref, so changing the system clock,
reloading, or opening a second tab cannot extend the session.

**Tested — and this is the most interesting test in the repo:**

```typescript
// web/scripts/verification-flow-test.ts
process.env.DATABASE_PATH = path.join(os.tmpdir(), `prov-verification-test-${process.pid}.db`);
```

The test sets its own temp database, then **backdates `expiresAt`** to simulate
30 minutes passing. From the file header: *"Expiry is the property most worth
testing, and the only honest way to test it is to move the clock. An HTTP test
can only assert that a 30-minute timer was *asked* for, not that it is
*enforced*."*

---

## 4. Performance is not integrity

**The constraint.** Challenge performance and session integrity are two
separate measurements. They are stored separately, computed separately, and
never blended into one number. Neither can overwrite the other.

**Why it matters.** A single blended score hides exactly the case a recruiter
needs to see: a strong candidate whose session looked unusual, or a weak answer
set from someone who was entirely clean.

**How it is enforced — in the schema:**

```sql
overallScore    REAL,   -- challenge performance only, NOT integrity
integrityStatus TEXT,   -- pending | normal | review | flagged
```

The comment on those two columns in `web/lib/db.ts` reads: *"Deliberate design
point: challenge performance and session integrity are two SEPARATE measurements
and are stored separately. Nothing in the schema lets an integrity flag rewrite
a challenge score, or vice versa."*

The two flows also live in **separate tables that never reference each other**.

**And in the finalisation logic — four lines that make the rule concrete:**

```typescript
// web/lib/skill-verification.ts - finalizeIfComplete()
const integrity: IntegrityStatus = rolled ?? "review";
const overall: number = overallPerformance(scores);
const finalResult: FinalResult = integrity === "normal" ? "verified" : "review_required";
```

**Integrity never enters the score calculation.** The consequences, stated in the
source comment:

| Session | Result |
| --- | --- |
| 3 perfect scores + flagged integrity | `REVIEW_REQUIRED` — the strong answers are still shown |
| 3 poor scores + clean integrity | `VERIFIED` — the weak answers are still shown |
| 3 perfect scores + **no** integrity reading | `REVIEW_REQUIRED` — absence of a reading is itself a fact |

That last row is the sharpest version of the rule. *"We have no integrity
reading" is itself something a recruiter should see.*

**And in the UI.** `web/components/RecruiterSkillVerification.tsx` renders
*Challenge performance* and *Integrity signals* as two independent large
figures. The code states the reason: *"never combined into one number here,
because a single blended score would hide exactly the case that matters."*

The candidate result panel closes with the same point in user-facing language:
*"These are two separate measurements. A strong answer set and an integrity flag
are both shown to the recruiter as they are; neither one cancels the other."*

**Scoring is a rubric match, not a model — and the UI says so.** Concept coverage
capped at 85, plus depth worth 15. Deterministic, inspectable, computed
server-side against a rubric the browser never received. *A verification score a
candidate cannot audit is not much of a verification.*

**Tested:** the flow test has a step named *"integrity as separate axis"*.

---

## 5. REVIEW and FLAGGED require a human, never an accusation

**The constraint.** No automated rejection exists. `REVIEW` and `FLAGGED` are
prompts for a person to look. The system never claims a candidate cheated, and
the word "cheating" never appears in the product.

**Why it matters.** A single noisy signal — bad lighting, an accent, a pause to
think, a second monitor — must not cost someone a job. An automated rejection
from an unvalidated heuristic is a fairness failure, not a security feature.

**Vocabulary mapping — the change is the feature:**

| ML result | Product status | Recruiter sees |
| --- | --- | --- |
| `pass` | `normal` | Signals normal |
| `flagged` | `review` | **Worth a human look** |
| `fail` | `flagged` | **Flagged for review** |
| *nothing* | `review` | **Worth a human look** |

```typescript
// web/lib/challenges.ts
case "fail":
  return "flagged";
default:
  return "review"; // no signal at all is unknown, not clean
```

**`reviewedByHR` is `True` for everything except a clean pass**, set at the
fusion layer in `ml/verification/fusion.py` — not in the UI, not conditionally.

**`fail` means "route to a human with suspicion", never "candidate is banned".**
The fusion source comment is explicit: *"Strong multi-signal or single
very-bad-signal case. Still not an auto-reject — just a stronger recommendation
to the human."*

**The UI states it next to the numbers:** *"A recruiter decides, not the
system."* And on the recruiter applicant page: *"A flagged result routes to a
human reviewer rather than rejecting the candidate."*

**Invalid statuses are rejected, not coerced:**

```typescript
if (status !== "normal" && status !== "review" && status !== "flagged") {
  fail(`status must be one of normal|review|flagged, got ...`, 400, "BAD_STATUS");
}
```

Posting `status: "cheating"` gets a `400`, and the word never enters the
database.

**Tested — a test for our own wording.** `verification-flow-test.ts` includes a
step that scans the entire session payload for the substrings `"cheat"` and
`"cheating"` and fails if either appears. Wording is a safety mechanism, and
safety mechanisms should be tested.

**Where a flag *does* affect a number:** the screening multiplier discounts
`flagged` and `fail` to **0.5×** — discounted, never **zeroed**. Zeroing would be
an automatic rejection by arithmetic, which is exactly what this constraint
forbids.

---

## 6. Token security

**The constraint.** Tokens are a server-authoritative reward. A client cannot
choose an amount, cannot fabricate the event that earned it, and cannot be paid
twice for the same event.

**Why it matters.** Any client-supplied amount is a vulnerability, not a
feature.

**The client cannot choose the amount.** The earn endpoint accepts only an event
type and an optional reference id:

> *"The request body carries ONLY the event type and an optional reference id.
> There is deliberately no `amount` field… Posting
> `{type:"VERIFICATION_COMPLETION"}` without a real passing session is a 409, not
> 50 tokens."*

Sending `amount` returns **`400 AMOUNT_NOT_ACCEPTED`** rather than being silently
ignored, so a client cannot believe it succeeded.

**Every reward is re-derived from real tables.** `validateEvent()` proves the
event happened by querying the actual data:

| Event | Proof required | Error if absent |
| --- | --- | --- |
| `PROFILE_COMPLETION` | headline non-empty **and** ≥3 skills **and** resume on file | `PROFILE_INCOMPLETE` |
| `RESUME_UPLOAD` | a resume file exists | `NO_RESUME` |
| `JOB_APPLICATION` | the application row exists | `NO_SUCH_APPLICATION` |
| `VERIFICATION_COMPLETION` | a session with `result === "pass"` exists | `NOT_VERIFIED` / `VERIFICATION_NOT_PASSED` |
| `ASSESSMENT_COMPLETION` | a real completed `assessment_attempts` row | `NO_SUCH_ATTEMPT` |
| `ACHIEVEMENT` | a real `candidate_achievements` unlock | `ACHIEVEMENT_NOT_UNLOCKED` |

**`flagged` and `fail` are explicitly not rewarded.** Verification tokens require
a `pass`.

**No double payment — twice over:**

1. `UNIQUE (candidateId, type, referenceId)` on `token_transactions`
2. `UNIQUE (candidateId, achievementId)` on `candidate_achievements`

> *"A candidate therefore cannot be paid twice for the same achievement even if
> the whole unlock path is re-run."*

`referenceId` defaults to `''` rather than `NULL`, because **SQLite treats
`NULL`s as distinct in a unique index, which would defeat the duplicate guard
entirely.** That is a real bug this design avoids.

**Balances are recomputed, never assigned.** `lifetimeEarned`, `lifetimeSpent`
and `balance` are always derived from the ledger.

**Idempotency is checked before the balance** in `spend()`, so a retried request
is a clean no-op:

> *"a retried spend request must be a clean no-op; otherwise the retry sees the
> already-debited balance and fails with INSUFFICIENT_TOKENS, which reads like a
> real error and invites a client to retry harder."*

**Amounts are bounded** to positive integers ≤ 10,000.

**Caps are enforced server-side**, and the `ACTIVE_SESSION` bucket is derived
from the **server's** clock — *"a forged value can't buy extra buckets."* It is
also deliberately mean: *"A tab left open all night tops out at 20."*

**Tokens are not money.** The `lib/tokens.ts` header states it: *"They are NOT
money: nothing here is redeemable, transferable, or has cash value."*

**Tested:** `tokens-test.mjs` has 9 steps including *"Client cannot choose the
amount"* and *"Duplicate event prevention"*. `assessments-test.mjs` includes
*"Client cannot dictate reward or score"*.

---

## 7. No tokens in hiring scores

**The constraint.** Tokens never influence any ranking, score, multiplier or
recommendation. They are structurally absent from the hiring path.

**Why it matters.** Engagement is not merit. A rewards programme that leaks into
ranking measures how much someone clicks, not what they can do — and it
penalises candidates who have other things to do.

**How it is enforced — by absence, verified by inspection:**

- No recruiter page renders a token balance. `TokenBalanceCard` appears only on
  candidate routes.
- No ranking formula references tokens. The only multiplier is
  `verificationMultiplier` in `resume_screening/shortlist.py`:
  `pass 1.2 · unverified 1.0 · flagged/fail 0.5`.
- `recommendedJobs` is "open jobs not yet applied to", ordered by stored
  `shortlist_results.rankScore` — not by token balance.
- The leaderboard (`/api/tokens/leaderboard`) is candidate-facing only.

**The recruiter job page says so on screen:**

> *"Screening ranks resumes against these skills. Verification multiplies the
> result; tokens never do."*

And on the applicant detail page:

> *"Tokens are engagement rewards and are not shown to recruiters because they
> play no part in ranking."*

**On the security side**, the assessment submit endpoint actively **rejects**
client-supplied `amount`, `tokenReward`, `score`, `wallet` and `balance`, and the
payout is read from the assessment row's own `tokenReward` — *"so changing the
reward is a data change, not a code change — and a client cannot influence it."*

---

## 8. Synthetic demo data is labelled

**The constraint.** Every piece of demo data is identifiable as synthetic — in
the data, in the UI, in the API responses, and in this documentation. No
fabricated screenshot, metric or accuracy figure is presented as real.

**Why it matters.** A demo that lies about itself is worse than no demo. A
reviewer who discovers a fabricated number stops trusting every real one.

**Marked in the data:**

- Every seeded row carries a **`demo_` id prefix** — `demo_cand_`, `demo_job_`,
  `demo_app_`, `demo_vs_`, `demo_svs_`, `demo_seed_2026`.
- Candidate emails use a reserved domain (`@demo.local`).
- The fictional employer's stored tagline reads: **"SYNTHETIC DEMO EMPLOYER —
  fictional company, fictional roles."**
- The schema has a `demo` column on `skill_verification_sessions`.

**Marked in the UI:**

- A **"synthetic demo"** badge on candidate and recruiter verification views.
- A `DemoNotice` on recruiter shortlist views.
- `DEMO_SCORE_NOTE` on the shortlist page: *"Demo data. These screening scores
  are deterministic fixtures written by `npm run seed:demo` — they are not output
  from the resume-screening model. The scoring arithmetic, ranking and tokens are
  real."*
- `DEMO_VERIFICATION_NOTE`: *"No camera, microphone or verification model
  produced them, and none of it is biometric data."*

**Marked in the seed's own output** — it prints three disclaimers on every run.

**Marked in this documentation** — see [ai.md §10](../ai.md#10-synthetic-and-demo-data)
and [docs/images/](images/README.md).

**Reset is safe and self-verifying.** `npm run reset:demo` deletes by
`id GLOB 'demo_*'` — `GLOB`, not `LIKE`, because **in `LIKE` an underscore is a
single-character wildcard** and would over-match real rows. It then asserts that
**zero** non-demo rows were deleted, and **exits non-zero if any were**.

**The label logic cannot be broken by a bundling accident.**
`web/lib/demo-marker.ts` is a **zero-import** module, deliberately dependency-free
so both the server seed and the client bundle can read the same constants.

**One deliberate omission:** the seed does **not** hand-pick achievement unlocks.
They are evaluated by the real `evaluateAchievements()` against real progress
rules, because *"hand-picking unlocks would be the fastest way to ship an
impossible state (a 'Verified' badge on a candidate with no passing session)."*

**What we have not fabricated:** no confusion matrix, no precision/recall
figures, no F1 scores, no accuracy claims. `docs/anti-gaming-paper.md` still
carries explicit `TODO` placeholders, and we flag that file as incomplete rather
than quietly leaving plausible-looking numbers in it.

---

## 9. The ML services remain intact

**The constraint.** This submission is documentation. No application code,
model, threshold, weight or service is changed, stubbed, replaced or removed.

**Why it matters.** A submission that improves its reported numbers by editing
the code it is reporting on is not a submission.

**What was done:** documentation files were added — `README.md`, `resource.md`,
`ai.md`, `docs/architecture.md`, `docs/constraints.md`, `docs/setup.md`,
`docs/limitations.md`, `docs/images/README.md`. Nothing else was modified.

**Specifically preserved:**

| Preserved | Where |
| --- | --- |
| Fusion weights and thresholds | `ml/verification/fusion.py` — `WEIGHTS`, `PASS_THRESHOLD`, `FAIL_THRESHOLD` unchanged |
| Gaze model and thresholds | `ml/verification/gaze.py`, `models/face_landmarker.task` |
| Lip-sync via SyncNet | `ml/verification/lipsync.py`, including its neutral-`0.5`-on-missing behaviour |
| Audio heuristics | `ml/verification/audio.py` |
| Screening formula | `resume_screening/score.py` — `SKILL_WEIGHT 0.7`, `TFIDF_WEIGHT 0.3` |
| Verification multipliers | `resume_screening/shortlist.py` — `pass 1.2`, `None 1.0`, `flagged/fail 0.5` |
| Token reward rules | `web/lib/tokens.ts` — all 9 rules and their caps |
| Curation and scoring | `web/lib/challenges.ts` — the bank, the cascade, `scoreAnswer()` |
| Schema and constraints | `web/lib/db.ts` — all 15 tables and every `UNIQUE` |
| Service contracts | `ml/verification/service.py`, `resume_screening/service.py` |

**Verification run before submission:** `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run test:verification`, `npm test`, `npm run test:e2e`, and
`python -m resume_screening.selftest`. Results are recorded in
[resource.md §6](../resource.md#6-hackmysuru-submission--declaration-checklist).

**Where documentation was stale, we flagged it rather than silently "fixing"
either side.** `README-ml-anti-gaming.md` and `docs/anti-gaming-paper.md` §2.1
both describe lip-sync as *"mouth-aspect-ratio vs audio-envelope correlation"*.
The implementation is SyncNet. We documented the discrepancy in
[ai.md](../ai.md#lip-sync) and left both pre-existing files untouched.

**We did not claim a liveness signal that does not exist.** `integrity_events.signal`
accepts `liveness` as a reserved schema value, and the demo fixtures carry
synthetic `livenessScore` constants annotated *"No liveness column exists"*.
There is no `ml/verification/liveness.py` in this codebase. An implementation
exists on a separate, unmerged branch that we do not count as a PROV
capability. See
[ai.md](../ai.md#liveness-is-not-implemented-on-this-branch).

---

## 10. Supporting constraints

### The client is never trusted with a decision

The skill-verification client sends exactly two things: a `candidateId` and an
`answer`. Never a timestamp, never a duration, never a score, never an integrity
verdict.

| Client attempt | Result |
| --- | --- |
| Supplied `score` | Ignored — computed server-side from the rubric |
| Supplied `expiresAt` | Ignored — written once by the server |
| `amount` on a token earn | `400 AMOUNT_NOT_ACCEPTED` |
| Replayed submit | `409 CHALLENGE_ALREADY_SUBMITTED`, guaranteed by `UNIQUE` |
| Another candidate's session id | `404 SESSION_NOT_FOUND` — the **same** 404 as an unknown id |
| `status: "cheating"` | `400 BAD_STATUS` |

**Cross-candidate isolation** deserves its own note: a wrong-candidate probe
returns the *same* 404 as an unknown session id, because *"a wrong-candidate probe
should not confirm that someone else's session id exists."*

### Answer keys never reach the browser

- `PublicChallenge = Omit<BankChallenge, "rubric" | "domains" | "aliases">`
- `PublicAssessment` omits `answerIndex`; `StoredQuestion` appears in no
  client-facing type
- *"The rubric is deliberately absent: the answer key must never reach the
  client, exactly as the assessment endpoints strip `answerIndex`."*

### A submitted answer cannot be edited

`UNIQUE (sessionId, challengeId)` is the **primary** guarantee — a replayed
submit is a constraint violation, not a silent overwrite. `submitChallenge()`
additionally guards the race:

```typescript
if (err instanceof Error && /UNIQUE|constraint/i.test(err.message)) {
  fail("this challenge has already been submitted and cannot be changed", 409, "CHALLENGE_ALREADY_SUBMITTED");
}
```

### Every signal can fail neutral

If a signal cannot be computed it returns **`0.5`** with a diagnostic note, never
`0.0` or `1.0`. A failed detector is an unknown, not evidence. The pipeline keeps
running and says so in diagnostics.

### No auto-rejection anywhere

There is no code path in the repository that rejects, disqualifies or bans a
candidate. Applications move `submitted → verified | verification_flagged`, and
the flagged state routes to a human.

### Honest empty states

`web/lib/score-label.ts` never renders a placeholder that could be mistaken for a
real score — no `"0.000"`, no `"-"`, no `"N/A"`. Unranked applicants read
*"awaiting screening"*; unapplied jobs read *"Apply to get AI screening score"*.

---

## Verification commands

Every constraint above that can be machine-checked, is:

```bash
cd web
npm run test:verification   # 72 assertions: expiry, isolation, immutability, vocabulary
npm test                    # + tokens, achievements, assessments
npm run test:e2e            # full flow, needs all three services
```

```bash
python -m resume_screening.selftest   # screening ranking sanity
```

Checklist and results: [resource.md §6](../resource.md#6-hackmysuru-submission--declaration-checklist).

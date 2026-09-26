import fs from "node:fs";
import path from "node:path";

import { getDb, nowIso, UPLOAD_DIR } from "./db.ts";
import { evaluateAchievements } from "./achievements.ts";
import { startAttempt, submitAttempt } from "./assessments.ts";
import { getOrCreateWallet, earn, TokenError, type TokenType } from "./tokens.ts";
import {
  DEMO_APPLICATIONS,
  DEMO_ASSESSMENTS,
  DEMO_CANDIDATES,
  DEMO_COMPANY,
  DEMO_JOBS,
  DEMO_SEED_REF,
  DEMO_VERIFICATIONS,
  type DemoCandidateSpec,
} from "./demo-data.ts";

/**
 * Demo seed / reset engine.
 *
 * Written against the same modules the HTTP routes use, so a seeded row is
 * indistinguishable from a row the running product created — except for its
 * `demo_` id prefix. In particular:
 *
 *   * Token balances are never assigned. Every credit goes through
 *     `earn()` / `earnWithAmount()` (the latter only ever called by the
 *     assessment and achievement subsystems, exactly as in production), and
 *     the wallet is whatever `recomputeTotals()` derives from the ledger.
 *     So `balance === sum(transactions)` holds by construction.
 *   * Assessment scores are never written. `startAttempt()` +
 *     `submitAttempt()` grade real answers, and the reward is the assessment
 *     row's own `tokenReward`.
 *   * Achievements are never written. `evaluateAchievements()` decides.
 *   * Verification signals are NOT produced by the verification ML service —
 *     they are the hand-picked constants in demo-data.ts, stamped as
 *     synthetic, and flagged rows are marked reviewedByHR.
 *   * Screening scores are NOT produced by the resume-screening ML service.
 *     They come from `estimateDemoScore()` below and carry the
 *     `demo_seed_2026` namespace in their primary key. Running the real
 *     pipeline from the recruiter's Shortlists screen replaces them.
 *
 * Nothing here starts a server or makes an HTTP request.
 */

// ------------------------------------------------------------------ helpers

/** Stable demo ids, so a second run recognises its own rows. */
const candidateId = (key: string) => `demo_cand_${key}`;
const jobId = (key: string) => `demo_job_${key}`;
const applicationId = (candidateKey: string, jobKey: string) => `demo_app_${candidateKey}_${jobKey}`;
const verificationId = (candidateKey: string, jobKey: string) => `demo_vs_${candidateKey}_${jobKey}`;
/** The `demo_seed_2026` namespace, on the one table with no marker column. */
const shortlistId = (candidateKey: string, jobKey: string) => `${DEMO_SEED_REF}_sl_${candidateKey}_${jobKey}`;

/** The column types `node:sqlite` will bind. Mirrors its `SupportedValueType`. */
type SqlValue = null | number | bigint | string | Uint8Array;

function daysAgoIso(days: number): string {
  // Fixed hour (09:30 UTC) so a re-seed on the same day produces the same
  // timestamps, which keeps the "created" columns stable and readable.
  const d = new Date(Date.now() - days * 86_400_000);
  d.setUTCHours(9, 30, 0, 0);
  return d.toISOString();
}

// ------------------------------------------------- synthetic screening score

/**
 * DEMO SCORE ESTIMATOR — NOT THE ML MODEL.
 *
 * The real resume-screening service (resume_screening/score.py) blends a
 * literal required-skill match at 0.7 with a TF-IDF cosine at 0.3, then
 * multiplies by the verification multiplier. Re-running that over HTTP would
 * make `npm run seed:demo` depend on a running service, which it must not, so
 * this reproduces the *shape* deterministically and cheaply:
 *
 *   skillsScore — a genuine word-boundary search of the seeded resume text for
 *                 the role's required skills. This half is real matching
 *                 against real text, it is just not TF-IDF.
 *   depthScore  — a stand-in for the TF-IDF half: how much of the role's
 *                 vocabulary the resume covers beyond the literal skills, plus
 *                 a small length term. Deterministic, so a re-seed reproduces
 *                 the same numbers.
 *
 * The output is written with the `demo_seed_2026` prefix precisely so nobody
 * can read it as model output. The recruiter's "Run screening" button calls
 * the real service and overwrites every row in a job's shortlist.
 */
const DEMO_SKILL_WEIGHT = 0.7;
const DEMO_DEPTH_WEIGHT = 0.3;

export function estimateDemoScore(
  resumeText: string,
  requiredSkills: string[],
  jobText = "",
): { resumeScore: number; skillsScore: number; depthScore: number; matched: string[]; missing: string[] } {
  const contains = (needle: string) =>
    new RegExp(`\\b${needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i").test(
      resumeText,
    );

  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of requiredSkills) {
    // Same rule the Python matcher uses: word boundaries, case-insensitive.
    if (contains(skill)) matched.push(skill);
    else missing.push(skill);
  }

  const skillsScore = requiredSkills.length === 0 ? 0 : matched.length / requiredSkills.length;

  // Stand-in for the similarity half. The real half compares each resume
  // against the rest of the applicant pool with TF-IDF; this checks how much
  // of the role's vocabulary the resume covers at all, which separates two
  // candidates with the same literal skill hits. Word-bounded, so "Aditya"
  // does not count as a hit for "data".
  //
  // The generic half of the vocabulary is deliberately broad. A narrow list
  // would let one strong resume saturate the signal and push a verified
  // candidate's rankScore past 1.0, which reads as a bug on a demo screen
  // even though it is arithmetically correct.
  const generic =
    "analytics data report reporting research design interview hiring candidate analysis study results " +
    "team project management marketing sales operations finance legal quality training workshop " +
    "presentation documentation testing deployment monitoring customer product service delivery " +
    "process pipeline dashboard metric measure evaluate build maintain create write review";
  const vocab = Array.from(
    new Set(
      `${requiredSkills.join(" ")} ${jobText} ${generic}`
        .split(/\s+/)
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
        .filter((w) => w.length > 3),
    ),
  );
  const coverage = vocab.length === 0 ? 0 : vocab.filter(contains).length / vocab.length;
  const depthScore = Math.max(0, Math.min(1, 0.8 * coverage + 0.2 * Math.min(1, resumeText.length / 1600)));

  const resumeScore = round4(DEMO_SKILL_WEIGHT * skillsScore + DEMO_DEPTH_WEIGHT * depthScore);
  return { resumeScore, skillsScore: round4(skillsScore), depthScore: round4(depthScore), matched, missing };
}

/** Documented in resume_screening/shortlist.py. */
const VERIFICATION_MULTIPLIERS: Record<string, number> = { pass: 1.2, flagged: 0.5, fail: 0.5 };

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

// ------------------------------------------------------------------- writing

/**
 * Upsert a demo row. `ON CONFLICT DO UPDATE` rather than DO NOTHING, so
 * re-seeding after editing demo-data.ts actually refreshes the content. The
 * primary keys are fixed, so this can only ever touch demo rows.
 */
function upsert(
  db: ReturnType<typeof getDb>,
  table: string,
  id: string,
  columns: string[],
  values: SqlValue[],
  conflict: string[],
  updateValues: SqlValue[],
): void {
  const placeholders = columns.map(() => "?").join(", ");
  db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${conflict.map((c) => `${c} = ?`).join(", ")}`,
  ).run(...values, ...updateValues);
}

// -------------------------------------------------------------------- seeding

export type SeedSummary = {
  company: string;
  recruiterEmail: string;
  jobs: number;
  candidates: number;
  applications: number;
  shortlistRecords: number;
  assessments: number;
  achievements: number;
  tokenTransactions: number;
  verificationRecords: number;
  tokenBalances: { name: string; email: string; balance: number }[];
  screeningSource: "demo_seed_2026" | "not-seeded";
  created: { jobs: number; candidates: number; applications: number; verifications: number };
  updated: { jobs: number; candidates: number; applications: number; verifications: number };
};

export function seedDemo(): SeedSummary {
  const db = getDb();
  const created = { jobs: 0, candidates: 0, applications: 0, verifications: 0 };
  const updated = { jobs: 0, candidates: 0, applications: 0, verifications: 0 };

  // -- 1. candidates, with their synthetic resume files on disk --------------
  const demoDir = path.join(UPLOAD_DIR, "demo");
  fs.mkdirSync(demoDir, { recursive: true });

  for (const c of DEMO_CANDIDATES) {
    const id = candidateId(c.key);
    const existed = Boolean(db.prepare("SELECT id FROM candidates WHERE id = ?").get(id));

    let resumePath: string | null = null;
    if (c.resumeFile && c.resumeText) {
      const stored = `demo/${c.resumeFile}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, stored), c.resumeText, "utf8");
      resumePath = stored;
    }

    const columns = ["id", "name", "email", "headline", "skills", "resumePath", "resumeName", "resumeText", "createdAt"];
    const values = [
      id,
      c.name,
      c.email,
      c.headline,
      JSON.stringify(c.skills),
      resumePath,
      c.resumeFile,
      c.resumeText,
      daysAgoIso(c.joinedDaysAgo),
    ];
    // Never clobber a createdAt that a previous run wrote.
    const conflict = ["name", "email", "headline", "skills", "resumePath", "resumeName", "resumeText"];
    const updateValues = values.slice(1, 8);
    if (existed) {
      upsert(db, "candidates", id, columns, values, conflict, updateValues);
      updated.candidates++;
    } else {
      db.prepare(
        `INSERT INTO candidates (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      ).run(...values);
      created.candidates++;
    }
  }

  // -- 2. jobs ---------------------------------------------------------------
  for (const j of DEMO_JOBS) {
    const id = jobId(j.key);
    const existed = Boolean(db.prepare("SELECT id FROM jobs WHERE id = ?").get(id));
    const columns = ["id", "title", "company", "location", "description", "requiredSkills", "status", "createdAt"];
    const values = [
      id,
      j.title,
      DEMO_COMPANY.name,
      j.location,
      j.description,
      JSON.stringify(j.requiredSkills),
      "open",
      daysAgoIso(j.postedDaysAgo),
    ];
    const conflict = ["title", "company", "location", "description", "requiredSkills", "status"];
    if (existed) {
      upsert(db, "jobs", id, columns, values, conflict, values.slice(1, 7));
      updated.jobs++;
    } else {
      db.prepare(`INSERT INTO jobs (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
        ...values,
      );
      created.jobs++;
    }
  }

  // -- 3. applications -------------------------------------------------------
  for (const a of DEMO_APPLICATIONS) {
    const id = applicationId(a.candidateKey, a.jobKey);
    const existed = Boolean(db.prepare("SELECT id FROM applications WHERE id = ?").get(id));
    const columns = ["id", "candidateId", "jobId", "note", "status", "createdAt"];
    const values = [
      id,
      candidateId(a.candidateKey),
      jobId(a.jobKey),
      a.note,
      // Real ranking in step 6 overwrites this with a pipeline status that
      // agrees with the score. This is only what a fresh row starts as.
      "applied",
      daysAgoIso(a.appliedDaysAgo),
    ];
    if (existed) {
      db.prepare(
        `INSERT INTO applications (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
         ON CONFLICT(id) DO UPDATE SET note = ?`,
      ).run(...values, a.note);
      updated.applications++;
    } else {
      db.prepare(`INSERT INTO applications (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
        ...values,
      );
      created.applications++;
    }
  }

  // -- 4. verification sessions (SYNTHETIC, clearly labelled) ----------------
  for (const v of DEMO_VERIFICATIONS) {
    const appId = applicationId(v.candidateKey, v.jobKey);
    const hasApp = db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
    if (!hasApp) continue; // the application must exist for the FK to hold
    const id = verificationId(v.candidateKey, v.jobKey);
    const existed = Boolean(db.prepare("SELECT id FROM verification_sessions WHERE id = ?").get(id));
    // Mirrors the weighted fusion the service applies, so the four numbers
    // shown in the UI are not internally contradictory.
    const fused = round4(0.25 * v.gazeScore + 0.4 * v.lipSyncScore + 0.35 * v.audioScore);
    const columns = [
      "id",
      "applicationId",
      "gazeScore",
      "lipSyncScore",
      "audioScore",
      "fusedScore",
      "result",
      "reviewedByHR",
      "reasons",
      "rawSignals",
      "createdAt",
    ];
    const rawSignals = JSON.stringify({
      livenessScore: v.livenessScore,
      gazeScore: v.gazeScore,
      lipSyncScore: v.lipSyncScore,
      audioScore: v.audioScore,
      _synthetic: true,
      _demoSeed: DEMO_SEED_REF,
      _note: "Synthetic demo values. Not a biometric measurement, not produced by the verification ML service.",
    });
    const values = [
      id,
      appId,
      v.gazeScore,
      v.lipSyncScore,
      v.audioScore,
      fused,
      v.result,
      v.reviewedByHR ? 1 : 0,
      JSON.stringify(v.reasons),
      rawSignals,
      daysAgoIso(v.daysAgo),
    ];
    if (existed) {
      db.prepare(
        `INSERT INTO verification_sessions (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
         ON CONFLICT(id) DO UPDATE SET gazeScore = ?, lipSyncScore = ?, audioScore = ?, fusedScore = ?,
           result = ?, reviewedByHR = ?, reasons = ?, rawSignals = ?`,
      ).run(...values, v.gazeScore, v.lipSyncScore, v.audioScore, fused, v.result, v.reviewedByHR ? 1 : 0, JSON.stringify(v.reasons), rawSignals);
      updated.verifications++;
    } else {
      db.prepare(
        `INSERT INTO verification_sessions (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      ).run(...values);
      created.verifications++;
    }
  }

  // -- 5. screening scores, namespaced as demo seed rows ---------------------
  for (const job of DEMO_JOBS) {
    const jid = jobId(job.key);
    const rows = db
      .prepare(
        `SELECT a.id AS applicationId, a.candidateId, c.name, c.resumeText,
                (SELECT v.result FROM verification_sessions v WHERE v.applicationId = a.id) AS verificationResult
         FROM applications a JOIN candidates c ON c.id = a.candidateId
         WHERE a.jobId = ?`,
      )
      .all(jid) as Record<string, unknown>[];

    const scored = rows.map((r) => {
      const text = String(r.resumeText ?? "");
      const detail = estimateDemoScore(text, job.requiredSkills, `${job.title} ${job.domain} ${job.experienceLevel}`);
      const result = (r.verificationResult as string | null) ?? null;
      const multiplier = VERIFICATION_MULTIPLIERS[result ?? "none"] ?? 1;
      return {
        applicationId: String(r.applicationId),
        candidateId: String(r.candidateId),
        detail,
        multiplier,
        rankScore: round4(detail.resumeScore * multiplier),
      };
    });
    scored.sort((a, b) => b.rankScore - a.rankScore || a.candidateId.localeCompare(b.candidateId));

    const createdAt = nowIso();
    db.prepare("DELETE FROM shortlist_results WHERE jobId = ?").run(jid);
    scored.forEach((s, i) => {
      db.prepare(
        `INSERT INTO shortlist_results
           (id, jobId, applicationId, rank, resumeScore, skillsScore, tfidfScore, rankScore,
            matchedSkills, missingSkills, verificationMultiplier, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        shortlistId(String(s.candidateId).replace(/^demo_cand_/, ""), job.key),
        jid,
        s.applicationId,
        i + 1,
        s.detail.resumeScore,
        s.detail.skillsScore,
        // Named tfidfScore because that is the column; the value is the demo
        // depth estimate, which is why the row id is namespaced.
        s.detail.depthScore,
        s.rankScore,
        JSON.stringify(s.detail.matched),
        JSON.stringify(s.detail.missing),
        s.multiplier,
        createdAt,
      );
    });

    // -- 6. recruiter pipeline status, derived from the ranking above so the
    //       status and the score can never contradict each other.
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i];
      const rank = i + 1;
      // The most recent application in the job is left un-reviewed on purpose,
      // so the demo always has an "applied" row to show. Only applied to a
      // candidate who is not already near the top, so it never hides the
      // "interview" story.
      const isNewest = s.applicationId === newestApplicationId(jid);
      const status =
        isNewest && rank > 3
          ? "applied"
          : rank === 1
            ? "interview"
            : rank <= 3
              ? "shortlisted"
              : rank <= 5
                ? "screening"
                : "not_shortlisted";
      db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, s.applicationId);
    }
  }

  // -- 7. assessments, through the real start/submit/grader/reward path ------
  for (const spec of DEMO_ASSESSMENTS) {
    const cid = candidateId(spec.candidateKey);
    const existing = db
      .prepare("SELECT id FROM assessment_attempts WHERE candidateId = ? AND assessmentId = ?")
      .get(cid, spec.assessmentId) as { id: string; completed: number } | undefined;
    if (existing) continue; // already graded and paid; never re-grade

    startAttempt(cid, spec.assessmentId);
    if (spec.complete) {
      submitAttempt(cid, spec.assessmentId, answersFor(candidateSpec(spec.candidateKey), spec.assessmentId, spec.correct));
    }
  }

  // -- 8. token ledger, through the existing reward API ----------------------
  //      Order matters: a PROFILE_COMPLETION credit is only valid once the
  //      resume and skills are on file, a JOB_APPLICATION credit only once the
  //      application row exists, and VERIFICATION_COMPLETION only after a
  //      passing session.
  for (const c of DEMO_CANDIDATES) {
    const cid = candidateId(c.key);
    // Pinned reference, not earn()'s "today" default. Left to itself the
    // daily-login credit would be re-minted on whichever day the seeder next
    // runs, so a re-seed tomorrow would quietly change every balance. This
    // still goes through the real earn() and its daily cap; it is just
    // idempotent across days rather than only within one.
    safeEarn(cid, "DAILY_LOGIN", `${DEMO_SEED_REF}_signin`);
    if (c.resumeFile) safeEarn(cid, "RESUME_UPLOAD");
    safeEarn(cid, "PROFILE_COMPLETION"); // no-ops when the profile is incomplete
    for (const a of DEMO_APPLICATIONS.filter((x) => x.candidateKey === c.key)) {
      safeEarn(cid, "JOB_APPLICATION", applicationId(a.candidateKey, a.jobKey));
    }
    for (const v of DEMO_VERIFICATIONS.filter((x) => x.candidateKey === c.key && x.result === "pass")) {
      safeEarn(cid, "VERIFICATION_COMPLETION", applicationId(v.candidateKey, v.jobKey));
    }
  }

  // -- 9. achievements, decided by the existing progress rules --------------
  for (const c of DEMO_CANDIDATES) {
    evaluateAchievements(candidateId(c.key));
  }

  // -- summary --------------------------------------------------------------
  const count = (sql: string, ...params: SqlValue[]) => Number((db.prepare(sql).get(...params) as { n: number }).n);
  const demoCandidateIds = DEMO_CANDIDATES.map((c) => candidateId(c.key));
  const ph = demoCandidateIds.map(() => "?").join(",");

  return {
    company: DEMO_COMPANY.name,
    recruiterEmail: DEMO_COMPANY.recruiterEmail,
    jobs: count("SELECT COUNT(*) AS n FROM jobs WHERE id GLOB 'demo_*'"),
    candidates: count("SELECT COUNT(*) AS n FROM candidates WHERE id GLOB 'demo_*'"),
    applications: count("SELECT COUNT(*) AS n FROM applications WHERE id GLOB 'demo_*'"),
    shortlistRecords: count("SELECT COUNT(*) AS n FROM shortlist_results WHERE id GLOB 'demo_*'"),
    assessments: count(
      `SELECT COUNT(*) AS n FROM assessment_attempts WHERE candidateId IN (${ph}) AND completed = 1`,
      ...demoCandidateIds,
    ),
    achievements: count(
      `SELECT COUNT(*) AS n FROM candidate_achievements WHERE candidateId IN (${ph})`,
      ...demoCandidateIds,
    ),
    tokenTransactions: count(
      `SELECT COUNT(*) AS n FROM token_transactions WHERE candidateId IN (${ph})`,
      ...demoCandidateIds,
    ),
    verificationRecords: count("SELECT COUNT(*) AS n FROM verification_sessions WHERE id GLOB 'demo_*'"),
    tokenBalances: DEMO_CANDIDATES.map((c) => {
      const w = getOrCreateWallet(candidateId(c.key));
      return { name: c.name, email: c.email, balance: w.balance };
    }),
    screeningSource: "demo_seed_2026",
    created,
    updated,
  };
}

function newestApplicationId(jobIdValue: string): string | null {
  const row = getDb()
    .prepare("SELECT id FROM applications WHERE jobId = ? ORDER BY createdAt DESC, id DESC LIMIT 1")
    .get(jobIdValue) as { id: string } | undefined;
  return row?.id ?? null;
}

function candidateSpec(key: string): DemoCandidateSpec {
  const found = DEMO_CANDIDATES.find((c) => c.key === key);
  if (!found) throw new Error(`unknown demo candidate: ${key}`);
  return found;
}

/**
 * Builds a real answer map with exactly `correct` right answers.
 *
 * The key is read from the assessment row the same way the grader reads it —
 * server-side, inside the seed. This is not a way to obtain the key from a
 * browser: nothing here is exposed over HTTP, and the seeded attempt is
 * already completed so a candidate can never re-submit it for a better score.
 */
function answersFor(candidate: DemoCandidateSpec, assessmentIdValue: string, correct: number): Record<string, number> {
  const db = getDb();
  const row = db.prepare("SELECT questions, active FROM assessments WHERE id = ?").get(assessmentIdValue) as
    | { questions: string; active: number }
    | undefined;
  if (!row || !row.active) throw new Error(`assessment unavailable: ${assessmentIdValue}`);

  const questions = (JSON.parse(row.questions) as { id: string; options: string[]; answerIndex: number }[]).filter(
    (q) => typeof q.answerIndex === "number" && Array.isArray(q.options),
  );
  // Spread the wrong answers across the option list so the stored review is
  // not the same single wrong option every time.
  const wrongOptions = questions.map((q) => {
    const options = q.options.map((_, i) => i).filter((i) => i !== q.answerIndex);
    return options[Math.floor(candidate.name.length + q.id.length) % options.length];
  });

  const answers: Record<string, number> = {};
  questions.forEach((q, i) => {
    answers[q.id] = i < correct ? q.answerIndex : (wrongOptions[i] ?? 0);
  });
  return answers;
}

/**
 * Calls the real reward function and swallows only the "not eligible" errors.
 *
 * Every one of those errors means the same thing — the rule's proof that the
 * event happened is not satisfied — so the seed records nothing and moves on.
 * Anything else is a real bug and is rethrown.
 */
function safeEarn(candidateIdValue: string, type: TokenType, referenceId?: string): void {
  try {
    earn(candidateIdValue, type, referenceId);
  } catch (err) {
    if (err instanceof TokenError) return;
    throw err;
  }
}

// -------------------------------------------------------------------- reset

export type ResetSummary = {
  candidates: number;
  jobs: number;
  applications: number;
  shortlistResults: number;
  verificationSessions: number;
  wallets: number;
  tokenTransactions: number;
  assessmentAttempts: number;
  candidateAchievements: number;
  resumeFiles: number;
  /** Non-demo rows removed. Must be 0. */
  preserved: { candidates: number; jobs: number; applications: number };
};

/**
 * Removes ONLY demo rows.
 *
 * Selection is by the `demo_` id prefix, which no production row can have
 * (`newId()` always emits `cand_`, `job_`, `app_`, `vs_`, `sl_`, `att_`,
 * `tok_`, `wal_`, `cach_` or `achv_`). Everything a candidate owns cascades
 * from the candidate row, so wallets, ledger entries, attempts and unlocks go
 * with it.
 *
 * The `assessments` and `achievements` tables are reference data shared by
 * every user and are never touched.
 */
export function resetDemo(): ResetSummary {
  const db = getDb();
  const demoCandidates = (db.prepare("SELECT id FROM candidates WHERE id GLOB 'demo_*'").all() as { id: string }[]).map(
    (r) => r.id,
  );
  const ph = demoCandidates.length ? demoCandidates.map(() => "?").join(",") : "''";

  const count = (sql: string, ...params: SqlValue[]) => Number((db.prepare(sql).get(...params) as { n: number }).n);

  // Count the rows a reset must NOT touch, so the leak check below is a real
  // before/after comparison of non-demo rows rather than a restatement of the
  // total.
  const nonDemo = () => ({
    candidates: count("SELECT COUNT(*) AS n FROM candidates WHERE id NOT GLOB 'demo_*'"),
    jobs: count("SELECT COUNT(*) AS n FROM jobs WHERE id NOT GLOB 'demo_*'"),
    applications: count("SELECT COUNT(*) AS n FROM applications WHERE id NOT GLOB 'demo_*'"),
  });
  const before = nonDemo();

  const summary: ResetSummary = {
    candidates: demoCandidates.length,
    jobs: count("SELECT COUNT(*) AS n FROM jobs WHERE id GLOB 'demo_*'"),
    applications: count("SELECT COUNT(*) AS n FROM applications WHERE id GLOB 'demo_*'"),
    shortlistResults: count("SELECT COUNT(*) AS n FROM shortlist_results WHERE id GLOB 'demo_*'"),
    verificationSessions: count("SELECT COUNT(*) AS n FROM verification_sessions WHERE id GLOB 'demo_*'"),
    wallets: count(`SELECT COUNT(*) AS n FROM candidate_wallets WHERE candidateId IN (${ph})`, ...demoCandidates),
    tokenTransactions: count(`SELECT COUNT(*) AS n FROM token_transactions WHERE candidateId IN (${ph})`, ...demoCandidates),
    assessmentAttempts: count(
      `SELECT COUNT(*) AS n FROM assessment_attempts WHERE candidateId IN (${ph})`,
      ...demoCandidates,
    ),
    candidateAchievements: count(
      `SELECT COUNT(*) AS n FROM candidate_achievements WHERE candidateId IN (${ph})`,
      ...demoCandidates,
    ),
    resumeFiles: 0,
    preserved: { candidates: 0, jobs: 0, applications: 0 },
  };

  db.exec("BEGIN");
  try {
    // Children first so the delete is not relying on cascade ordering, and so
    // the counts above and below can be compared row for row.
    db.prepare("DELETE FROM shortlist_results WHERE id GLOB 'demo_*' OR jobId GLOB 'demo_*'").run();
    db.prepare("DELETE FROM verification_sessions WHERE id GLOB 'demo_*'").run();
    db.prepare("DELETE FROM token_transactions WHERE candidateId IN (" + ph + ")").run();
    db.prepare("DELETE FROM candidate_wallets WHERE candidateId IN (" + ph + ")").run();
    db.prepare("DELETE FROM assessment_attempts WHERE candidateId IN (" + ph + ")").run();
    db.prepare("DELETE FROM candidate_achievements WHERE candidateId IN (" + ph + ")").run();
    db.prepare("DELETE FROM applications WHERE id GLOB 'demo_*' OR candidateId IN (" + ph + ")").run();
    db.prepare("DELETE FROM candidates WHERE id GLOB 'demo_*'").run();
    db.prepare("DELETE FROM jobs WHERE id GLOB 'demo_*'").run();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Resume files live outside the database, so clean them up too.
  const demoDir = path.join(UPLOAD_DIR, "demo");
  if (fs.existsSync(demoDir)) {
    summary.resumeFiles = fs.readdirSync(demoDir).length;
    fs.rmSync(demoDir, { recursive: true, force: true });
  }

  const after = nonDemo();
  summary.preserved = {
    candidates: before.candidates - after.candidates,
    jobs: before.jobs - after.jobs,
    applications: before.applications - after.applications,
  };
  return summary;
}

export function demoDataPresent(): boolean {
  const db = getDb();
  return Number((db.prepare("SELECT COUNT(*) AS n FROM candidates WHERE id GLOB 'demo_*'").get() as { n: number }).n) > 0;
}

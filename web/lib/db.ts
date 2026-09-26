import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SEED_ACHIEVEMENTS, SEED_ASSESSMENTS } from "./seed-data.ts";

/**
 * SQLite via Node's built-in `node:sqlite` -- no native module to compile,
 * so `npm install` stays at zero extra dependencies and the demo can't be
 * broken by a prebuild mismatch.
 *
 * The file lives outside `web/` so it survives `next dev` restarts and is
 * trivially inspectable with any sqlite3 CLI during the demo.
 */

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hr.db");

declare global {
  // Next's dev server re-evaluates modules on every hot reload; without
  // caching on globalThis we'd leak a new connection per reload until
  // Windows starts refusing file handles.
  var __hrDb: DatabaseSync | undefined;
}

function connect(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__hrDb) globalThis.__hrDb = connect();
  // Re-run the (idempotent, CREATE TABLE IF NOT EXISTS) migration on every
  // access rather than only at connect time. Without this, a dev server that
  // reuses its cached connection never picks up newly added tables, and every
  // query against them fails with "no such table".
  migrate(globalThis.__hrDb);
  return globalThis.__hrDb;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS candidates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  headline     TEXT DEFAULT '',
  skills       TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  resumePath   TEXT,                          -- relative to UPLOAD_DIR
  resumeName   TEXT,
  resumeText   TEXT,                          -- filled in by the screening service
  createdAt    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  company        TEXT NOT NULL,
  location       TEXT DEFAULT '',
  description    TEXT DEFAULT '',
  requiredSkills TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  status         TEXT NOT NULL DEFAULT 'open',
  createdAt      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id           TEXT PRIMARY KEY,
  candidateId  TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  jobId        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note         TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'submitted',
  createdAt    TEXT NOT NULL,
  UNIQUE (candidateId, jobId)
);

CREATE TABLE IF NOT EXISTS shortlist_results (
  id                      TEXT PRIMARY KEY,
  jobId                   TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicationId           TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rank                    INTEGER NOT NULL,
  resumeScore             REAL NOT NULL,
  skillsScore             REAL NOT NULL,
  tfidfScore              REAL NOT NULL,
  rankScore               REAL NOT NULL,
  matchedSkills           TEXT NOT NULL DEFAULT '[]',
  missingSkills           TEXT NOT NULL DEFAULT '[]',
  verificationMultiplier  REAL NOT NULL DEFAULT 1.0,
  createdAt               TEXT NOT NULL,
  UNIQUE (jobId, applicationId)
);

CREATE TABLE IF NOT EXISTS verification_sessions (
  id             TEXT PRIMARY KEY,
  applicationId  TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  gazeScore      REAL,
  lipSyncScore   REAL,
  audioScore     REAL,
  fusedScore     REAL,
  result         TEXT NOT NULL,          -- pass | flagged | fail
  reviewedByHR   INTEGER NOT NULL DEFAULT 0,
  reasons        TEXT NOT NULL DEFAULT '[]',
  rawSignals     TEXT NOT NULL DEFAULT '{}',
  createdAt      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(jobId);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidateId);
CREATE INDEX IF NOT EXISTS idx_shortlist_job ON shortlist_results(jobId, rank);
CREATE INDEX IF NOT EXISTS idx_verification_app ON verification_sessions(applicationId);

-- Candidate Rewards / Tokens -------------------------------------------------
-- Engagement currency only. Not money, not redeemable, no cash value. Kept in
-- its own tables rather than a column on candidates so the ledger is a proper
-- append-only audit trail and the balance is always derivable from it.
CREATE TABLE IF NOT EXISTS candidate_wallets (
  id             TEXT PRIMARY KEY,
  candidateId    TEXT NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  balance        INTEGER NOT NULL DEFAULT 0,
  lifetimeEarned INTEGER NOT NULL DEFAULT 0,
  lifetimeSpent  INTEGER NOT NULL DEFAULT 0,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id          TEXT PRIMARY KEY,
  candidateId TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Idempotency key for the event that caused this row (application id, the
  -- active-session time bucket, ...). Empty string rather than NULL because
  -- SQLite treats NULLs as distinct in a UNIQUE index, which would defeat the
  -- duplicate guard entirely.
  referenceId TEXT NOT NULL DEFAULT '',
  createdAt   TEXT NOT NULL
);

-- One row per (candidate, type, reference). This is what makes a replayed
-- earn request a no-op instead of a double payout.
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_txn
  ON token_transactions(candidateId, type, referenceId);
CREATE INDEX IF NOT EXISTS idx_token_txn_candidate ON token_transactions(candidateId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_token_txn_type ON token_transactions(candidateId, type, createdAt DESC);

-- Assessments ------------------------------------------------------------------
-- \`questions\` is a JSON array of {id, prompt, options[], answerIndex}. The
-- answerIndex never leaves the server: the read endpoints strip it, so a client
-- cannot read the key out of a GET and self-submit a perfect score.
CREATE TABLE IF NOT EXISTS assessments (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  domain      TEXT NOT NULL DEFAULT 'general',
  questions   TEXT NOT NULL DEFAULT '[]',   -- JSON array, see note above
  active      INTEGER NOT NULL DEFAULT 1,
  tokenReward INTEGER NOT NULL DEFAULT 20,  -- server-owned payout amount
  createdAt   TEXT NOT NULL
);

-- One row per (candidate, assessment). The UNIQUE constraint is what makes a
-- replayed start/submit impossible rather than merely unlikely.
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id           TEXT PRIMARY KEY,
  candidateId  TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessmentId TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score        REAL,
  correctCount INTEGER,
  totalCount   INTEGER,
  completed    INTEGER NOT NULL DEFAULT 0,
  startedAt    TEXT NOT NULL,
  completedAt  TEXT,
  UNIQUE (candidateId, assessmentId)
);

CREATE INDEX IF NOT EXISTS idx_attempts_candidate ON assessment_attempts(candidateId, completedAt DESC);

-- Achievements ----------------------------------------------------------------
-- Definitions are static rows so the reward amount lives in the database, not
-- in the request body and not in a client bundle.
CREATE TABLE IF NOT EXISTS achievements (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  tokenReward   INTEGER NOT NULL DEFAULT 0,
  displayOrder  INTEGER NOT NULL DEFAULT 0
);

-- A candidate can only ever hold one row per achievement; the UNIQUE index is
-- the primary "never reward the same achievement twice" guarantee, backed up by
-- the token ledger's own (candidateId, type, referenceId) uniqueness.
CREATE TABLE IF NOT EXISTS candidate_achievements (
  id            TEXT PRIMARY KEY,
  candidateId   TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  achievementId TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlockedAt    TEXT NOT NULL,
  UNIQUE (candidateId, achievementId)
);

CREATE INDEX IF NOT EXISTS idx_candidate_achievements ON candidate_achievements(candidateId, unlockedAt DESC);
`;

function migrate(db: DatabaseSync) {
  db.exec(SCHEMA);
  seed(db);
}

/**
 * Idempotent reference-data seed. Runs on every getDb() like the schema does,
 * so it must be cheap and must never clobber an operator's edits:
 * INSERT ... ON CONFLICT DO NOTHING means an existing row always wins.
 */
function seed(db: DatabaseSync) {
  const insertAssessment = db.prepare(
    `INSERT INTO assessments (id, title, description, domain, questions, active, tokenReward, createdAt)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const a of SEED_ASSESSMENTS) {
    insertAssessment.run(a.id, a.title, a.description, a.domain, JSON.stringify(a.questions), a.tokenReward, nowIso());
  }

  const insertAchievement = db.prepare(
    `INSERT INTO achievements (id, code, title, description, tokenReward, displayOrder)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO NOTHING`,
  );
  for (const ach of SEED_ACHIEVEMENTS) {
    insertAchievement.run(`achv_${ach.code.toLowerCase()}`, ach.code, ach.title, ach.description, ach.tokenReward, ach.displayOrder);
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Uploads go to disk under web/.uploads so nothing large lands in git. */
export const UPLOAD_DIR = path.join(process.cwd(), ".uploads");

export function ensureUploadDir(): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

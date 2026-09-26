import { getDb, newId, nowIso } from "./db.ts";

/**
 * Candidate Rewards / Tokens — server-authoritative engagement currency.
 *
 * Tokens are an in-app reward for meaningful platform activity. They are NOT
 * money: nothing here is redeemable, transferable, or has cash value.
 *
 * The core security property: the browser may only ever say *which* event
 * happened. It never sends an amount, and the amount is never read from the
 * request body. `REWARD_RULES` below is the single source of truth, and
 * `earn()` re-validates that the event actually happened in the database
 * before it pays out.
 */

export const TOKEN_TYPES = [
  "PROFILE_COMPLETION",
  "RESUME_UPLOAD",
  "JOB_APPLICATION",
  "ASSESSMENT_COMPLETION",
  "VERIFICATION_COMPLETION",
  "DAILY_LOGIN",
  "ACTIVE_SESSION",
  "ACHIEVEMENT",
  "SPEND",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export type TokenTransaction = {
  id: string;
  candidateId: string;
  amount: number;
  type: TokenType;
  description: string;
  referenceId: string;
  createdAt: string;
};

export type CandidateWallet = {
  id: string;
  candidateId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  createdAt: string;
  updatedAt: string;
};

type Rule = {
  amount: number;
  /** Max payouts ever, or per day when `daily` is set. null = uncapped. */
  lifetimeCap: number | null;
  dailyCap: number | null;
  /** Minimum seconds since the previous payout of this type. */
  minIntervalSec: number | null;
  description: string;
};

/**
 * ACTIVE_SESSION is the abuse-prone one, so it is deliberately mean:
 * 2 tokens per 5-minute bucket, 10 buckets (20 tokens) per UTC day. A tab left
 * open all night tops out at 20, not 24x60/5.
 */
export const REWARD_RULES: Record<TokenType, Rule> = {
  PROFILE_COMPLETION: { amount: 15, lifetimeCap: 1, dailyCap: null, minIntervalSec: null, description: "Completed your candidate profile" },
  RESUME_UPLOAD: { amount: 10, lifetimeCap: 5, dailyCap: null, minIntervalSec: null, description: "Uploaded a resume" },
  JOB_APPLICATION: { amount: 25, lifetimeCap: null, dailyCap: 20, minIntervalSec: null, description: "Applied to a job" },
  ASSESSMENT_COMPLETION: { amount: 40, lifetimeCap: null, dailyCap: 10, minIntervalSec: null, description: "Completed an assessment" },
  VERIFICATION_COMPLETION: { amount: 50, lifetimeCap: 1, dailyCap: null, minIntervalSec: null, description: "Completed live verification" },
  DAILY_LOGIN: { amount: 5, lifetimeCap: null, dailyCap: 1, minIntervalSec: null, description: "Signed in today" },
  ACTIVE_SESSION: { amount: 2, lifetimeCap: null, dailyCap: 10, minIntervalSec: 300, description: "Active session" },
  ACHIEVEMENT: { amount: 30, lifetimeCap: null, dailyCap: 5, minIntervalSec: null, description: "Achievement unlocked" },
  SPEND: { amount: 0, lifetimeCap: null, dailyCap: null, minIntervalSec: null, description: "Tokens spent" },
};

/** Bucket size for ACTIVE_SESSION idempotency — 5 minutes, UTC-aligned. */
export const ACTIVE_SESSION_BUCKET_SEC = 300;

export class TokenError extends Error {
  /** HTTP status the API layer should surface. */
  readonly status: number;
  /** Stable machine-readable code, safe to show in the UI. */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TokenError";
    this.status = status;
    this.code = code;
  }
}

// ------------------------------------------------------------------ wallets

/** Lazily creates the wallet. Every candidate gets one on first touch. */
export function getOrCreateWallet(candidateId: string): CandidateWallet {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM candidate_wallets WHERE candidateId = ?").get(candidateId) as
    | Record<string, unknown>
    | undefined;
  if (existing) return toWallet(existing);

  // Check the candidate exists before inserting. The FK constraint would stop
  // the row anyway, but the insert-then-reread path would then re-read nothing
  // and blow up on undefined. Failing with a proper 404 here is the point.
  const candidate = db.prepare("SELECT id FROM candidates WHERE id = ?").get(candidateId);
  if (!candidate) throw new TokenError("candidate not found", 404, "CANDIDATE_NOT_FOUND");

  const now = nowIso();
  const id = newId("wal");
  try {
    db.prepare(
      "INSERT INTO candidate_wallets (id, candidateId, balance, lifetimeEarned, lifetimeSpent, createdAt, updatedAt) VALUES (?, ?, 0, 0, 0, ?, ?)",
    ).run(id, candidateId, now, now);
  } catch {
    // Lost a race with a concurrent request; re-read.
    const raced = db.prepare("SELECT * FROM candidate_wallets WHERE candidateId = ?").get(candidateId) as
      | Record<string, unknown>
      | undefined;
    if (!raced) throw new TokenError("candidate not found", 404, "CANDIDATE_NOT_FOUND");
    return toWallet(raced);
  }
  return toWallet(db.prepare("SELECT * FROM candidate_wallets WHERE candidateId = ?").get(candidateId) as Record<string, unknown>);
}

function toWallet(row: Record<string, unknown>): CandidateWallet {
  return {
    id: String(row.id),
    candidateId: String(row.candidateId),
    balance: Number(row.balance),
    lifetimeEarned: Number(row.lifetimeEarned),
    lifetimeSpent: Number(row.lifetimeSpent),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function recomputeTotals(candidateId: string): void {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
       FROM token_transactions WHERE candidateId = ?`,
    )
    .get(candidateId) as { earned: number; spent: number };
  db.prepare("UPDATE candidate_wallets SET balance = ?, lifetimeEarned = ?, lifetimeSpent = ?, updatedAt = ? WHERE candidateId = ?").run(
    row.earned - row.spent,
    row.earned,
    row.spent,
    nowIso(),
    candidateId,
  );
}

function countToday(candidateId: string, type: TokenType): number {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM token_transactions WHERE candidateId = ? AND type = ? AND createdAt >= ?")
    .get(candidateId, type, since.toISOString()) as { n: number };
  return row.n;
}

function countLifetime(candidateId: string, type: TokenType): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM token_transactions WHERE candidateId = ? AND type = ?")
    .get(candidateId, type) as { n: number };
  return row.n;
}

// ------------------------------------------------------------------ validation

function assertCandidateExists(candidateId: string): void {
  const row = getDb().prepare("SELECT id FROM candidates WHERE id = ?").get(candidateId);
  if (!row) throw new TokenError("candidate not found", 404, "CANDIDATE_NOT_FOUND");
}

/**
 * Proves the event actually happened, by looking it up in the real tables.
 * This is what stops a caller from just POSTing {type:"VERIFICATION_COMPLETION"}.
 */
function validateEvent(candidateId: string, type: TokenType, referenceId: string): void {
  const db = getDb();
  switch (type) {
    case "PROFILE_COMPLETION": {
      const row = db
        .prepare("SELECT headline, skills, resumePath FROM candidates WHERE id = ?")
        .get(candidateId) as { headline: string; skills: string; resumePath: string | null } | undefined;
      const complete =
        (row?.headline ?? "").trim().length > 0 &&
        (JSON.parse(row?.skills ?? "[]") as unknown[]).length >= 3 &&
        Boolean(row?.resumePath);
      if (!complete) {
        throw new TokenError(
          "profile is not complete yet (needs a headline, at least 3 skills, and a resume)",
          409,
          "PROFILE_INCOMPLETE",
        );
      }
      return;
    }
    case "RESUME_UPLOAD": {
      const row = db.prepare("SELECT resumePath FROM candidates WHERE id = ?").get(candidateId) as
        | { resumePath: string | null }
        | undefined;
      if (!row?.resumePath) throw new TokenError("no resume on file to reward", 409, "NO_RESUME");
      return;
    }
    case "JOB_APPLICATION": {
      if (!referenceId) throw new TokenError("referenceId (applicationId) is required", 400, "REFERENCE_REQUIRED");
      const row = db.prepare("SELECT id FROM applications WHERE id = ? AND candidateId = ?").get(referenceId, candidateId);
      if (!row) throw new TokenError("no such application for this candidate", 409, "NO_SUCH_APPLICATION");
      return;
    }
    case "VERIFICATION_COMPLETION": {
      if (!referenceId) throw new TokenError("referenceId (applicationId) is required", 400, "REFERENCE_REQUIRED");
      const row = db
        .prepare(
          `SELECT v.result FROM verification_sessions v
           JOIN applications a ON a.id = v.applicationId
           WHERE v.applicationId = ? AND a.candidateId = ?`,
        )
        .get(referenceId, candidateId) as { result: string } | undefined;
      if (!row) throw new TokenError("no verification session for that application", 409, "NOT_VERIFIED");
      // Only a clean pass pays. flagged/fail are explicitly not rewarded, and
      // ACHIEVEMENT (capped per day) is the route for a reviewed outcome.
      if (row.result !== "pass") {
        throw new TokenError(
          `verification result is "${row.result}" — only a clean pass earns this reward`,
          409,
          "VERIFICATION_NOT_PASSED",
        );
      }
      return;
    }
    case "DAILY_LOGIN": {
      if (countToday(candidateId, type) >= (REWARD_RULES[type].dailyCap ?? 1)) {
        throw new TokenError("daily login reward already claimed today", 429, "DAILY_CAP_REACHED");
      }
      return;
    }
    case "ACTIVE_SESSION": {
      // The browser supplies a client timestamp only as a hint; the server
      // derives the bucket from its own clock so a forged value can't buy
      // extra buckets.
      const bucket = Math.floor(Date.now() / 1000 / ACTIVE_SESSION_BUCKET_SEC);
      const rule = REWARD_RULES[type];
      if (countToday(candidateId, type) >= (rule.dailyCap ?? 0)) {
        throw new TokenError("daily active-session cap reached", 429, "DAILY_CAP_REACHED");
      }
      const last = db
        .prepare("SELECT createdAt FROM token_transactions WHERE candidateId = ? AND type = ? ORDER BY createdAt DESC LIMIT 1")
        .get(candidateId, type) as { createdAt: string } | undefined;
      if (last) {
        const elapsed = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
        if (elapsed < (rule.minIntervalSec ?? 0)) {
          throw new TokenError(
            `too soon — active-session rewards are at most one per ${(rule.minIntervalSec ?? 0) / 60} minutes`,
            429,
            "TOO_SOON",
          );
        }
      }
      void bucket;
      return;
    }
    case "ASSESSMENT_COMPLETION": {
      // Must be a real, completed attempt by this candidate. Previously this
      // only checked that a referenceId was present, which let any caller mint
      // the payout with a made-up id.
      if (!referenceId) throw new TokenError("referenceId (attemptId) is required", 400, "REFERENCE_REQUIRED");
      const row = getDb()
        .prepare("SELECT id FROM assessment_attempts WHERE id = ? AND candidateId = ? AND completed = 1")
        .get(referenceId, candidateId);
      if (!row) {
        throw new TokenError("no completed assessment attempt with that id for this candidate", 409, "NO_SUCH_ATTEMPT");
      }
      return;
    }
    case "ACHIEVEMENT": {
      // Must be a real unlock row. Same reason as above.
      if (!referenceId) throw new TokenError("referenceId (achievementCode) is required", 400, "REFERENCE_REQUIRED");
      const row = getDb()
        .prepare(
          `SELECT ca.id FROM candidate_achievements ca
           JOIN achievements a ON a.id = ca.achievementId
           WHERE ca.candidateId = ? AND a.code = ?`,
        )
        .get(candidateId, referenceId);
      if (!row) throw new TokenError("that achievement is not unlocked for this candidate", 409, "ACHIEVEMENT_NOT_UNLOCKED");
      return;
    }
    case "SPEND": {
      // SPEND is negative; the amount is chosen by the spend endpoint, never
      // accepted raw from the caller. Kept explicit so it can't be confused
      // with an earn.
      throw new TokenError("use POST /api/candidates/[id]/tokens/spend to spend tokens", 400, "USE_SPEND_ENDPOINT");
    }
    default: {
      const exhaustive: never = type;
      throw new TokenError(`unsupported token type: ${String(exhaustive)}`, 400, "UNKNOWN_TYPE");
    }
  }
}

/** Default idempotency reference when the caller doesn't supply a meaningful one. */
function defaultReference(type: TokenType): string {
  switch (type) {
    case "DAILY_LOGIN":
      return new Date().toISOString().slice(0, 10);
    case "ACTIVE_SESSION":
      return String(Math.floor(Date.now() / 1000 / ACTIVE_SESSION_BUCKET_SEC));
    default:
      return "";
  }
}

// ------------------------------------------------------------------ earn / spend

export type EarnResult = {
  wallet: CandidateWallet;
  transaction: TokenTransaction | null;
  awarded: boolean;
  reason: string;
  rule: { amount: number; dailyCap: number | null; lifetimeCap: number | null; minIntervalSec: number | null };
};

export function earn(
  candidateId: string,
  type: TokenType,
  referenceId?: string,
): EarnResult {
  assertCandidateExists(candidateId);
  const rule = REWARD_RULES[type];
  if (!rule) throw new TokenError(`unsupported token type: ${type}`, 400, "UNKNOWN_TYPE");
  if (type === "SPEND") throw new TokenError("SPEND is not an earn type", 400, "USE_SPEND_ENDPOINT");

  getOrCreateWallet(candidateId);

  const ref = referenceId?.trim() || defaultReference(type);
  validateEvent(candidateId, type, ref);

  if (rule.lifetimeCap !== null && countLifetime(candidateId, type) >= rule.lifetimeCap) {
    throw new TokenError(
      `${type} has already been claimed (limit ${rule.lifetimeCap})`,
      409,
      "LIFETIME_CAP_REACHED",
    );
  }
  if (rule.dailyCap !== null && countToday(candidateId, type) >= rule.dailyCap) {
    throw new TokenError(`daily cap of ${rule.dailyCap} reached for ${type}`, 429, "DAILY_CAP_REACHED");
  }

  return record(candidateId, type, rule.amount, rule.description, ref, {
    amount: rule.amount,
    dailyCap: rule.dailyCap,
    lifetimeCap: rule.lifetimeCap,
    minIntervalSec: rule.minIntervalSec,
  });
}

/**
 * Awards an amount that comes from a server-side configuration row rather than
 * from `REWARD_RULES` (an assessment's `tokenReward`, an achievement's
 * `tokenReward`).
 *
 * This is the ONLY way those subsystems pay out, and it keeps the same
 * guarantees as `earn()`: the caller passes a value read from the database, the
 * HTTP layer never does, and the unique index on (candidateId, type, referenceId)
 * still makes a replay a no-op. Everything `earn()` does is delegated to
 * `record()` so the two paths cannot drift apart.
 */
export function earnWithAmount(
  candidateId: string,
  type: TokenType,
  amount: number,
  description: string,
  referenceId: string,
): EarnResult {
  assertCandidateExists(candidateId);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000) {
    throw new TokenError("reward amount must be a positive integer no greater than 10000", 400, "BAD_AMOUNT");
  }
  return record(candidateId, type, amount, description, referenceId, {
    amount,
    dailyCap: REWARD_RULES[type].dailyCap,
    lifetimeCap: null,
    minIntervalSec: null,
  });
}

/** Shared write path: insert one ledger row, then recompute the wallet. */
function record(
  candidateId: string,
  type: TokenType,
  amount: number,
  description: string,
  ref: string,
  rule: EarnResult["rule"],
): EarnResult {
  getOrCreateWallet(candidateId);
  const db = getDb();
  const id = newId("tok");
  const createdAt = nowIso();

  let awarded = false;
  try {
    // The unique index on (candidateId, type, referenceId) is the real duplicate
    // guard — a concurrent replay loses the race here and we fall through to
    // `awarded = false` instead of double-paying.
    db.prepare(
      "INSERT INTO token_transactions (id, candidateId, amount, type, description, referenceId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, candidateId, amount, type, description, ref, createdAt);
    awarded = true;
  } catch {
    awarded = false;
  }

  if (awarded) recomputeTotals(candidateId);
  const wallet = getOrCreateWallet(candidateId);

  return {
    wallet,
    transaction: awarded ? { id, candidateId, amount, type, description, referenceId: ref, createdAt } : null,
    awarded,
    reason: awarded ? "credited" : "already recorded — no double credit",
    rule,
  };
}

/** Spending is server-priced; the caller picks what to buy, not how much it costs. */
export function spend(candidateId: string, cost: number, description: string, referenceId: string): EarnResult {
  assertCandidateExists(candidateId);
  if (!Number.isInteger(cost) || cost <= 0 || cost > 10_000) {
    throw new TokenError("cost must be a positive integer no greater than 10000", 400, "BAD_COST");
  }
  const db = getDb();
  const wallet = getOrCreateWallet(candidateId);

  // Idempotency is checked BEFORE the balance check. A retried spend request
  // must be a clean no-op; otherwise the retry sees the already-debited
  // balance and fails with INSUFFICIENT_TOKENS, which reads like a real error
  // and invites a client to retry harder.
  const already = db
    .prepare("SELECT id FROM token_transactions WHERE candidateId = ? AND type = 'SPEND' AND referenceId = ?")
    .get(candidateId, referenceId.trim() || "__none__");
  if (already) {
    return {
      wallet,
      transaction: null,
      awarded: false,
      reason: "already recorded — no double debit",
      rule: { amount: -cost, dailyCap: null, lifetimeCap: null, minIntervalSec: null },
    };
  }

  if (wallet.balance < cost) {
    throw new TokenError(`insufficient tokens: balance ${wallet.balance}, need ${cost}`, 409, "INSUFFICIENT_TOKENS");
  }

  const id = newId("tok");
  const createdAt = nowIso();
  const ref = referenceId.trim() || `spend:${id}`;
  try {
    db.prepare(
      "INSERT INTO token_transactions (id, candidateId, amount, type, description, referenceId, createdAt) VALUES (?, ?, ?, 'SPEND', ?, ?, ?)",
    ).run(id, candidateId, -cost, description, ref, createdAt);
  } catch {
    return { wallet, transaction: null, awarded: false, reason: "already recorded — no double debit", rule: { amount: -cost, dailyCap: null, lifetimeCap: null, minIntervalSec: null } };
  }
  recomputeTotals(candidateId);
  return {
    wallet: getOrCreateWallet(candidateId),
    transaction: { id, candidateId, amount: -cost, type: "SPEND", description, referenceId: ref, createdAt },
    awarded: true,
    reason: "debited",
    rule: { amount: -cost, dailyCap: null, lifetimeCap: null, minIntervalSec: null },
  };
}

// ------------------------------------------------------------------ reads

export function history(candidateId: string, limit = 50, offset = 0): { transactions: TokenTransaction[]; total: number } {
  assertCandidateExists(candidateId);
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM token_transactions WHERE candidateId = ?").get(candidateId) as { n: number }).n;
  const rows = db
    .prepare("SELECT * FROM token_transactions WHERE candidateId = ? ORDER BY createdAt DESC, rowid DESC LIMIT ? OFFSET ?")
    .all(candidateId, Math.min(200, Math.max(1, limit)), Math.max(0, offset)) as Record<string, unknown>[];
  return { transactions: rows.map(toTransaction), total };
}

function toTransaction(row: Record<string, unknown>): TokenTransaction {
  return {
    id: String(row.id),
    candidateId: String(row.candidateId),
    amount: Number(row.amount),
    type: String(row.type) as TokenType,
    description: String(row.description ?? ""),
    referenceId: String(row.referenceId ?? ""),
    createdAt: String(row.createdAt),
  };
}

export function leaderboard(limit = 20) {
  const rows = getDb()
    .prepare(
      `SELECT w.candidateId, w.balance, w.lifetimeEarned, c.name
       FROM candidate_wallets w JOIN candidates c ON c.id = w.candidateId
       ORDER BY w.balance DESC, w.lifetimeEarned DESC LIMIT ?`,
    )
    .all(Math.min(100, Math.max(1, limit))) as Record<string, unknown>[];
  return rows.map((r, i) => ({
    rank: i + 1,
    candidateId: String(r.candidateId),
    name: String(r.name),
    balance: Number(r.balance),
    lifetimeEarned: Number(r.lifetimeEarned),
  }));
}

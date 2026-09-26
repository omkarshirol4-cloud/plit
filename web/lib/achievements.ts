import { getDb, newId, nowIso } from "./db.ts";
import { earnWithAmount, getOrCreateWallet } from "./tokens.ts";

/**
 * Achievements — a small set of milestone definitions evaluated against real
 * database state.
 *
 * Unlocking is idempotent by construction, twice over:
 *   1. `UNIQUE(candidateId, achievementId)` on candidate_achievements, so a
 *      second unlock attempt cannot insert a second record.
 *   2. The token ledger's own `UNIQUE(candidateId, type, referenceId)`, keyed on
 *      the achievement code.
 * A candidate therefore cannot be paid twice for the same achievement even if
 * the whole unlock path is re-run.
 *
 * The reward amount is read from the `achievements` row, never from a request.
 */

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  tokenReward: number;
  displayOrder: number;
};

export type AchievementView = Achievement & {
  unlocked: boolean;
  unlockedAt: string | null;
  /** Current measured progress, for the locked ones. */
  progress: number;
  target: number;
};

export type UnlockedAchievement = {
  code: string;
  title: string;
  description: string;
  tokenReward: number;
  unlockedAt: string;
};

/** Progress rules. Each returns [current, target]; current >= target unlocks. */
type ProgressFn = (candidateId: string) => [number, number];

export const ACHIEVEMENT_CODES = [
  "FIRST_APPLICATION",
  "PROFILE_COMPLETE",
  "VERIFIED_CANDIDATE",
  "FIRST_ASSESSMENT",
  "ACTIVE_JOB_SEEKER",
  "CONSISTENT_CANDIDATE",
] as const;

export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

function scalarCount(sql: string, candidateId: string): number {
  const row = getDb().prepare(sql).get(candidateId) as { n: number } | undefined;
  return row ? Number(row.n) : 0;
}

const PROGRESS: Record<AchievementCode, ProgressFn> = {
  FIRST_APPLICATION: (id) => [scalarCount("SELECT COUNT(*) AS n FROM applications WHERE candidateId = ?", id), 1],
  PROFILE_COMPLETE: (id) => {
    const row = getDb().prepare("SELECT headline, skills, resumePath FROM candidates WHERE id = ?").get(id) as
      | { headline: string; skills: string; resumePath: string | null }
      | undefined;
    let skillCount = 0;
    try {
      const parsed: unknown = JSON.parse(row?.skills ?? "[]");
      skillCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      skillCount = 0;
    }
    const complete =
      (row?.headline ?? "").trim().length > 0 && skillCount >= 3 && Boolean(row?.resumePath);
    return [complete ? 1 : 0, 1];
  },
  VERIFIED_CANDIDATE: (id) => [
    scalarCount(
      `SELECT COUNT(*) AS n FROM verification_sessions v
       JOIN applications a ON a.id = v.applicationId
       WHERE a.candidateId = ? AND v.result = 'pass'`,
      id,
    ),
    1,
  ],
  FIRST_ASSESSMENT: (id) => [scalarCount("SELECT COUNT(*) AS n FROM assessment_attempts WHERE candidateId = ? AND completed = 1", id), 1],
  ACTIVE_JOB_SEEKER: (id) => [scalarCount("SELECT COUNT(*) AS n FROM applications WHERE candidateId = ?", id), 5],
  CONSISTENT_CANDIDATE: (id) => {
    // "Meaningful activity on 5 different days" is read from the token ledger,
    // which only ever gains rows for verified real events. DAILY_LOGIN is
    // counted here because that is exactly the signal of showing up.
    const distinct = scalarCount(
      "SELECT COUNT(DISTINCT substr(createdAt, 1, 10)) AS n FROM token_transactions WHERE candidateId = ?",
      id,
    );
    return [distinct, 5];
  },
};

function toAchievement(row: Record<string, unknown>): Achievement {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    description: String(row.description ?? ""),
    tokenReward: Number(row.tokenReward),
    displayOrder: Number(row.displayOrder ?? 0),
  };
}

export class AchievementError extends Error {
  /** HTTP status the API layer should surface. */
  readonly status: number;
  /** Stable machine-readable code, safe to show in the UI. */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AchievementError";
    this.status = status;
    this.code = code;
  }
}

function assertCandidateExists(candidateId: string): void {
  if (!getDb().prepare("SELECT id FROM candidates WHERE id = ?").get(candidateId)) {
    throw new AchievementError("candidate not found", 404, "CANDIDATE_NOT_FOUND");
  }
}

/** All definitions, annotated with this candidate's unlock state and progress. */
export function listAchievements(candidateId: string): AchievementView[] {
  assertCandidateExists(candidateId);
  const db = getDb();
  const defs = db.prepare("SELECT * FROM achievements ORDER BY displayOrder ASC, code ASC").all() as Record<string, unknown>[];
  const unlocked = db
    .prepare(
      `SELECT a.code, ca.unlockedAt FROM candidate_achievements ca
       JOIN achievements a ON a.id = ca.achievementId
       WHERE ca.candidateId = ?`,
    )
    .all(candidateId) as { code: string; unlockedAt: string }[];
  const unlockedAt = new Map(unlocked.map((u) => [u.code, String(u.unlockedAt)]));

  return defs.map((row) => {
    const a = toAchievement(row);
    const at = unlockedAt.get(a.code) ?? null;
    const [progress, target] = PROGRESS[a.code as AchievementCode]?.(candidateId) ?? [0, 1];
    return { ...a, unlocked: at !== null, unlockedAt: at, progress, target };
  });
}

export function getUnlocked(candidateId: string): UnlockedAchievement[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.code, a.title, a.description, a.tokenReward, ca.unlockedAt
       FROM candidate_achievements ca
       JOIN achievements a ON a.id = ca.achievementId
       WHERE ca.candidateId = ?
       ORDER BY ca.unlockedAt ASC`,
    )
    .all(candidateId) as Record<string, unknown>[];
  return rows.map((r) => ({
    code: String(r.code),
    title: String(r.title),
    description: String(r.description ?? ""),
    tokenReward: Number(r.tokenReward),
    unlockedAt: String(r.unlockedAt),
  }));
}

/**
 * Re-evaluates every definition and unlocks whatever the candidate now qualifies
 * for. Safe to call on every page load: anything already unlocked is a no-op.
 *
 * Returns only the achievements unlocked by THIS call, so the UI can show a
 * notification for genuinely new ones without re-announcing old ones.
 */
export function evaluateAchievements(candidateId: string): { unlockedNow: UnlockedAchievement[]; wallet: { balance: number; lifetimeEarned: number } } {
  assertCandidateExists(candidateId);
  const db = getDb();
  const defs = db.prepare("SELECT * FROM achievements ORDER BY displayOrder ASC").all() as Record<string, unknown>[];
  const unlockedNow: UnlockedAchievement[] = [];

  for (const row of defs) {
    const a = toAchievement(row);
    const check = PROGRESS[a.code as AchievementCode];
    if (!check) continue;
    const [current, target] = check(candidateId);
    if (current < target) continue;

    // The insert is the lock. UNIQUE(candidateId, achievementId) makes a repeat
    // a no-op, and we only fall through to paying on the run that actually
    // created the row.
    const unlockedAt = nowIso();
    let created = false;
    try {
      db.prepare("INSERT INTO candidate_achievements (id, candidateId, achievementId, unlockedAt) VALUES (?, ?, ?, ?)").run(
        newId("cach"),
        candidateId,
        a.id,
        unlockedAt,
      );
      created = true;
    } catch {
      created = false;
    }
    if (!created) continue;

    // Amount comes from the definition row. referenceId is the achievement code,
    // so even a hypothetical duplicate unlock cannot pay twice.
    const earned = earnWithAmount(candidateId, "ACHIEVEMENT", a.tokenReward, `Achievement: ${a.title}`, a.code);
    if (earned.awarded) {
      unlockedNow.push({
        code: a.code,
        title: a.title,
        description: a.description,
        tokenReward: a.tokenReward,
        unlockedAt: unlockedAt,
      });
    }
  }

  const wallet = getOrCreateWallet(candidateId);
  return { unlockedNow, wallet: { balance: wallet.balance, lifetimeEarned: wallet.lifetimeEarned } };
}

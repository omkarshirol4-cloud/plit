import { getDb, newId, nowIso } from "./db.ts";
import { earnWithAmount, TokenError } from "./tokens.ts";

/**
 * Assessments — a deliberately small multiple-choice system.
 *
 * The security model mirrors the token ledger: the browser submits a map of
 * questionId -> chosen option index, and NOTHING else. It never submits a
 * score, never submits a token amount, and never sees the answer key. Grading
 * happens here against `answerIndex`, which is stripped by `toPublicAssessment`
 * and therefore absent from every API response and every page payload.
 *
 * Payment comes from the assessment row's own `tokenReward` column, so changing
 * the reward is a data change, not a code change — and a client cannot
 * influence it.
 */

export type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

/** Internal only. `answerIndex` must not appear in any client-facing type. */
type StoredQuestion = AssessmentQuestion & { answerIndex: number };

export type PublicAssessment = {
  id: string;
  title: string;
  description: string;
  domain: string;
  active: boolean;
  tokenReward: number;
  questionCount: number;
  questions: AssessmentQuestion[];
  createdAt: string;
};

export type AssessmentAttempt = {
  id: string;
  candidateId: string;
  assessmentId: string;
  score: number | null;
  correctCount: number | null;
  totalCount: number | null;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
};

/** Per-question breakdown shown on the result page. */
export type AnswerReview = {
  questionId: string;
  prompt: string;
  yourAnswer: number | null;
  correctAnswer: number;
  correct: boolean;
};

export class AssessmentError extends Error {
  /** HTTP status the API layer should surface. */
  readonly status: number;
  /** Stable machine-readable code, safe to show in the UI. */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AssessmentError";
    this.status = status;
    this.code = code;
  }
}

// ------------------------------------------------------------------ reads

function parseQuestions(raw: unknown): StoredQuestion[] {
  if (typeof raw !== "string" || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((q) => {
    const item = q as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const prompt = typeof item.prompt === "string" ? item.prompt : "";
    const options = Array.isArray(item.options) ? item.options.map(String) : [];
    const answerIndex = Number(item.answerIndex);
    if (!id || !prompt || options.length < 2 || !Number.isInteger(answerIndex)) return [];
    if (answerIndex < 0 || answerIndex >= options.length) return [];
    return [{ id, prompt, options, answerIndex }];
  });
}

/**
 * The single boundary where the answer key is dropped. Everything a client can
 * see goes through here, so the key cannot leak by accident.
 */
function toPublicAssessment(row: Record<string, unknown>): PublicAssessment {
  const questions = parseQuestions(row.questions);
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    domain: String(row.domain ?? "general"),
    active: Boolean(row.active),
    tokenReward: Number(row.tokenReward),
    questionCount: questions.length,
    questions: questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    createdAt: String(row.createdAt),
  };
}

function assertCandidateExists(candidateId: string): void {
  if (!getDb().prepare("SELECT id FROM candidates WHERE id = ?").get(candidateId)) {
    throw new AssessmentError("candidate not found", 404, "CANDIDATE_NOT_FOUND");
  }
}

export function listAssessments(includeInactive = false): PublicAssessment[] {
  const rows = getDb()
    .prepare(
      includeInactive
        ? "SELECT * FROM assessments ORDER BY createdAt ASC, id ASC"
        : "SELECT * FROM assessments WHERE active = 1 ORDER BY createdAt ASC, id ASC",
    )
    .all() as Record<string, unknown>[];
  return rows.map(toPublicAssessment);
}

export function getAssessment(id: string): PublicAssessment {
  const row = getDb().prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  if (!row) throw new AssessmentError("assessment not found", 404, "ASSESSMENT_NOT_FOUND");
  return toPublicAssessment(row as Record<string, unknown>);
}

function toAttempt(row: Record<string, unknown>): AssessmentAttempt {
  return {
    id: String(row.id),
    candidateId: String(row.candidateId),
    assessmentId: String(row.assessmentId),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    correctCount: row.correctCount === null || row.correctCount === undefined ? null : Number(row.correctCount),
    totalCount: row.totalCount === null || row.totalCount === undefined ? null : Number(row.totalCount),
    completed: Boolean(row.completed),
    startedAt: String(row.startedAt),
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

export function getAttempt(candidateId: string, assessmentId: string): AssessmentAttempt | null {
  const row = getDb()
    .prepare("SELECT * FROM assessment_attempts WHERE candidateId = ? AND assessmentId = ?")
    .get(candidateId, assessmentId);
  return row ? toAttempt(row as Record<string, unknown>) : null;
}

export function listAttempts(candidateId: string): AssessmentAttempt[] {
  const rows = getDb()
    .prepare("SELECT * FROM assessment_attempts WHERE candidateId = ? ORDER BY startedAt DESC")
    .all(candidateId) as Record<string, unknown>[];
  return rows.map(toAttempt);
}

// ------------------------------------------------------------------ writes

/**
 * Starts (or returns) the single attempt a candidate may have for an
 * assessment. The UNIQUE(candidateId, assessmentId) index means a double click
 * or a replayed request returns the existing attempt instead of creating a
 * second one.
 */
export function startAttempt(candidateId: string, assessmentId: string): { attempt: AssessmentAttempt; resumed: boolean } {
  assertCandidateExists(candidateId);
  const db = getDb();
  const assessment = db.prepare("SELECT id, active FROM assessments WHERE id = ?").get(assessmentId) as
    | { id: string; active: number }
    | undefined;
  if (!assessment) throw new AssessmentError("assessment not found", 404, "ASSESSMENT_NOT_FOUND");
  if (!assessment.active) throw new AssessmentError("this assessment is no longer available", 409, "ASSESSMENT_INACTIVE");

  const existing = db
    .prepare("SELECT * FROM assessment_attempts WHERE candidateId = ? AND assessmentId = ?")
    .get(candidateId, assessmentId) as Record<string, unknown> | undefined;
  if (existing) return { attempt: toAttempt(existing), resumed: true };

  const attempt = {
    id: newId("att"),
    candidateId,
    assessmentId,
    startedAt: nowIso(),
  };
  try {
    db.prepare(
      "INSERT INTO assessment_attempts (id, candidateId, assessmentId, score, correctCount, totalCount, completed, startedAt, completedAt) VALUES (?, ?, ?, NULL, NULL, NULL, 0, ?, NULL)",
    ).run(attempt.id, candidateId, assessmentId, attempt.startedAt);
  } catch {
    // Lost the race against a concurrent start; re-read the winner.
    const raced = db
      .prepare("SELECT * FROM assessment_attempts WHERE candidateId = ? AND assessmentId = ?")
      .get(candidateId, assessmentId) as Record<string, unknown>;
    return { attempt: toAttempt(raced), resumed: true };
  }
  return { attempt: toAttempt(db.prepare("SELECT * FROM assessment_attempts WHERE id = ?").get(attempt.id) as Record<string, unknown>), resumed: false };
}

export type SubmitResult = {
  attempt: AssessmentAttempt;
  assessment: PublicAssessment;
  review: AnswerReview[];
  correctCount: number;
  totalCount: number;
  score: number;
  passed: boolean;
  /** Server-priced payout, already applied to the wallet. */
  reward: { awarded: boolean; amount: number; reason: string; wallet: { balance: number; lifetimeEarned: number } };
};

/**
 * Grades a submission server-side and pays the assessment's configured reward.
 *
 * The client sends only `{ answers: { [questionId]: optionIndex } }`. The score
 * is computed here from the stored answer key, and the payout amount comes from
 * the assessment row — neither is readable or writable by the caller.
 *
 * Re-submitting a completed attempt returns the original result with
 * `reward.awarded = false`; it never pays twice.
 */
export function submitAttempt(candidateId: string, assessmentId: string, answers: Record<string, number>): SubmitResult {
  assertCandidateExists(candidateId);
  const db = getDb();

  const assessmentRow = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId) as
    | Record<string, unknown>
    | undefined;
  if (!assessmentRow) throw new AssessmentError("assessment not found", 404, "ASSESSMENT_NOT_FOUND");
  if (!assessmentRow.active) {
    throw new AssessmentError("this assessment is no longer available", 409, "ASSESSMENT_INACTIVE");
  }

  const questions = parseQuestions(assessmentRow.questions);
  if (questions.length === 0) {
    throw new AssessmentError("this assessment has no questions configured", 409, "NO_QUESTIONS");
  }

  const attemptRow = db
    .prepare("SELECT * FROM assessment_attempts WHERE candidateId = ? AND assessmentId = ?")
    .get(candidateId, assessmentId) as Record<string, unknown> | undefined;
  if (!attemptRow) {
    throw new AssessmentError("start the assessment before submitting", 409, "ATTEMPT_NOT_STARTED");
  }

  const assessment = toPublicAssessment(assessmentRow);
  const alreadyCompleted = Boolean(attemptRow.completed);

  // Grade either way so a replayed submit still returns a sensible review, but
  // only write + pay when this is the first completion.
  const safeAnswers = answers && typeof answers === "object" ? answers : {};
  const review: AnswerReview[] = questions.map((q) => {
    const raw = Number(safeAnswers[q.id]);
    const chosen = Number.isInteger(raw) && raw >= 0 && raw < q.options.length ? raw : null;
    return {
      questionId: q.id,
      prompt: q.prompt,
      yourAnswer: chosen,
      correctAnswer: q.answerIndex,
      correct: chosen === q.answerIndex,
    };
  });
  const correctCount = review.filter((r) => r.correct).length;
  const totalCount = questions.length;
  const score = Math.round((correctCount / totalCount) * 100);
  const passed = score >= 60;

  if (alreadyCompleted) {
    const result = earnWithAmount(
      candidateId,
      "ASSESSMENT_COMPLETION",
      Number(assessmentRow.tokenReward),
      `Completed: ${assessment.title}`,
      // Same referenceId as the first completion, so this is a guaranteed no-op
      // at the ledger level even if the attempt check above were removed.
      String(attemptRow.id),
    );
    return {
      attempt: toAttempt(attemptRow),
      assessment,
      review,
      correctCount,
      totalCount,
      score,
      passed,
      reward: {
        awarded: false,
        amount: Number(assessmentRow.tokenReward),
        reason: "already completed — no second reward",
        wallet: { balance: result.wallet.balance, lifetimeEarned: result.wallet.lifetimeEarned },
      },
    };
  }

  const completedAt = nowIso();
  db.prepare(
    "UPDATE assessment_attempts SET score = ?, correctCount = ?, totalCount = ?, completed = 1, completedAt = ? WHERE id = ?",
  ).run(score, correctCount, totalCount, completedAt, String(attemptRow.id));

  // Completion, not time spent, is what pays. The amount is the assessment's
  // configured tokenReward and the referenceId is the attempt, so the same
  // attempt can never be paid for twice.
  const earned = earnWithAmount(
    candidateId,
    "ASSESSMENT_COMPLETION",
    Number(assessmentRow.tokenReward),
    `Completed: ${assessment.title}`,
    String(attemptRow.id),
  );

  const updated = db.prepare("SELECT * FROM assessment_attempts WHERE id = ?").get(String(attemptRow.id)) as Record<string, unknown>;

  return {
    attempt: toAttempt(updated),
    assessment,
    review,
    correctCount,
    totalCount,
    score,
    passed,
    reward: {
      awarded: earned.awarded,
      amount: Number(assessmentRow.tokenReward),
      reason: earned.reason,
      wallet: { balance: earned.wallet.balance, lifetimeEarned: earned.wallet.lifetimeEarned },
    },
  };
}

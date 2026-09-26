/**
 * AI screening score presentation.
 *
 * A screening score only exists once the candidate has applied and the ML
 * screening service has actually scored that application. Before that there is
 * genuinely no number, so we never render a placeholder like "0.000", "-", or
 * "N/A" that could be mistaken for a real score. We say what will produce one.
 *
 * Kept as a pure function in its own module (no JSX, no node:sqlite) so both the
 * candidate UI and the test suite exercise the exact same logic.
 */
export type ScoreLabel =
  | { kind: "pending"; text: string }
  | { kind: "score"; text: string; value: number; multiplier: number | null };

export const PENDING_SCORE_TEXT = "Apply to get AI screening score";
export const PENDING_APPLIED_TEXT = "awaiting screening";

/** Label for a job the candidate has not applied to yet. */
export function recommendedScoreLabel(rankScore: number | null | undefined): ScoreLabel {
  if (rankScore === null || rankScore === undefined) {
    return { kind: "pending", text: PENDING_SCORE_TEXT };
  }
  return { kind: "score", text: rankScore.toFixed(3), value: rankScore, multiplier: null };
}

/** Label for an application that may or may not have been screened yet. */
export function applicationScoreLabel(
  rankScore: number | null | undefined,
  multiplier?: number | null,
): ScoreLabel {
  if (rankScore === null || rankScore === undefined) {
    return { kind: "pending", text: PENDING_APPLIED_TEXT };
  }
  return {
    kind: "score",
    text: rankScore.toFixed(3),
    value: rankScore,
    multiplier: multiplier === null || multiplier === undefined ? null : multiplier,
  };
}

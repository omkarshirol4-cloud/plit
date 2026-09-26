import { NextResponse } from "next/server";
import { AssessmentError, submitAttempt } from "@/lib/assessments";
import { evaluateAchievements } from "@/lib/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/assessments/[id]/submit — grade server-side and pay the reward.
 *
 * Body: { candidateId, answers: { [questionId]: optionIndex } }
 *
 * The client cannot influence the outcome beyond its chosen options:
 *   - `score` is not accepted, it is computed here from the stored answer key.
 *   - `amount` / `tokenReward` are not accepted; the payout is read from the
 *     assessment row via `earnWithAmount`.
 *   - Re-submitting a completed attempt returns the original result with
 *     `reward.awarded = false`, and the ledger's unique index backs that up.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const candidateId = String(body.candidateId ?? "").trim();
  if (!candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 });

  // Explicitly ignore any client attempt to dictate the payout.
  for (const forbidden of ["amount", "tokenReward", "score", "wallet", "balance"]) {
    if (forbidden in body) {
      return NextResponse.json(
        { error: `${forbidden} is determined by the server and cannot be supplied`, code: "CLIENT_VALUE_REJECTED" },
        { status: 400 },
      );
    }
  }

  const rawAnswers = body.answers;
  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    return NextResponse.json({ error: "answers must be an object of questionId -> option index" }, { status: 400 });
  }
  const answers: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawAnswers as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0) answers[k] = n;
  }

  try {
    const result = submitAttempt(candidateId, id, answers);
    // FIRST_ASSESSMENT may have just become true.
    const achievements = evaluateAchievements(candidateId);
    return NextResponse.json({ ...result, achievementsUnlocked: achievements.unlockedNow, wallet: achievements.wallet });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

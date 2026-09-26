import { NextResponse } from "next/server";
import { AssessmentError, getAssessment, getAttempt } from "@/lib/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/assessments/[id]/result?candidateId=... — the candidate's result.
 *
 * Deliberately does NOT return the per-question answer key: the result page
 * shows the score, the reward, and the attempt, and grading detail stays on the
 * server. Pass ?review=1 to include the per-question breakdown (correct/your
 * answer) without exposing anything the candidate could not already deduce from
 * their own submission once completed.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const candidateId = url.searchParams.get("candidateId")?.trim() ?? "";
  if (!candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 });

  try {
    const assessment = getAssessment(id);
    const attempt = getAttempt(candidateId, id);
    if (!attempt) {
      return NextResponse.json({ error: "no attempt for this candidate", code: "NO_ATTEMPT" }, { status: 404 });
    }
    return NextResponse.json({ assessment, attempt });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

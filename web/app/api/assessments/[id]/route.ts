import { NextResponse } from "next/server";
import { AssessmentError, getAssessment } from "@/lib/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/assessments/[id] — one assessment with its questions.
 *
 * `toPublicAssessment` strips `answerIndex`, so the response can be dumped into
 * a page or read in devtools without revealing the key.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ assessment: getAssessment(id) });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

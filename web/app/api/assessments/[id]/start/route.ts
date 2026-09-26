import { NextResponse } from "next/server";
import { AssessmentError, startAttempt } from "@/lib/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/assessments/[id]/start — open (or resume) an attempt.
 *
 * Body: { candidateId }. The candidate may only ever have one attempt per
 * assessment, enforced by UNIQUE(candidateId, assessmentId), so a double click
 * resumes the existing attempt instead of creating a second one.
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

  try {
    const { attempt, resumed } = startAttempt(candidateId, id);
    return NextResponse.json({ attempt, resumed }, { status: resumed ? 200 : 201 });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

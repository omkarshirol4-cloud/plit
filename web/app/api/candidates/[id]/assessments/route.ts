import { NextResponse } from "next/server";
import { AssessmentError, listAttempts } from "@/lib/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/candidates/[id]/assessments — this candidate's attempts. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ attempts: listAttempts(id) });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

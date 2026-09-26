import { NextResponse } from "next/server";
import { AssessmentError, listAssessments } from "@/lib/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/assessments — active assessments, answer key stripped. */
export async function GET() {
  try {
    return NextResponse.json({ assessments: listAssessments(false) });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

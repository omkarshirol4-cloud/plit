import { NextResponse } from "next/server";
import { AchievementError, getUnlocked, listAchievements } from "@/lib/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candidates/[id]/achievements — all definitions with this candidate's
 * unlock state and progress. Read-only; unlocking happens via /evaluate.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ achievements: listAchievements(id), unlocked: getUnlocked(id) });
  } catch (err) {
    if (err instanceof AchievementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

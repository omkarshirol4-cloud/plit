import { NextResponse } from "next/server";
import { AchievementError, evaluateAchievements } from "@/lib/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candidates/[id]/achievements/evaluate — unlock anything now earned.
 *
 * Takes no body and no arguments that could influence the outcome. It re-reads
 * real state (applications, resume, verification sessions, assessment attempts,
 * ledger days) and unlocks what qualifies. Safe to call repeatedly: anything
 * already unlocked is a no-op, and `unlockedNow` only contains genuinely new
 * unlocks so the UI can notify without re-announcing.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { unlockedNow, wallet } = evaluateAchievements(id);
    return NextResponse.json({ unlockedNow, wallet });
  } catch (err) {
    if (err instanceof AchievementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

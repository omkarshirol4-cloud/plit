import { NextResponse } from "next/server";
import { getOrCreateWallet, REWARD_RULES, TokenError } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/candidates/[id]/tokens — wallet balance + reward rules. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const wallet = getOrCreateWallet(id);
    return NextResponse.json({
      wallet,
      // Rules are exposed so a client can show "next reward in 4m" without
      // ever being trusted to compute an amount.
      rules: Object.fromEntries(
        Object.entries(REWARD_RULES).map(([k, v]) => [
          k,
          { amount: v.amount, dailyCap: v.dailyCap, lifetimeCap: v.lifetimeCap, minIntervalSec: v.minIntervalSec, description: v.description },
        ]),
      ),
    });
  } catch (err) {
    if (err instanceof TokenError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}

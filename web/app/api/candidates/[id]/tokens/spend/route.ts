import { NextResponse } from "next/server";
import { spend, TokenError } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candidates/[id]/tokens/spend   { cost, description, referenceId? }
 *
 * Deliberately a separate route from /earn so a negative amount can never be
 * smuggled through the earn path, and so `cost` is checked server-side against
 * the current balance. The caller chooses what to spend on, never the price.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const cost = Number(body.cost);
  const description = String(body.description ?? "Spent tokens").slice(0, 200);
  const referenceId = String(body.referenceId ?? "");

  try {
    const result = spend(id, cost, description, referenceId);
    return NextResponse.json(result, { status: result.awarded ? 201 : 200 });
  } catch (err) {
    if (err instanceof TokenError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}

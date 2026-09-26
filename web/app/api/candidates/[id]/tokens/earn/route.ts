import { NextResponse } from "next/server";
import { earn, TOKEN_TYPES, TokenError, type TokenType } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candidates/[id]/tokens/earn   { type, referenceId? }
 *
 * The request body carries ONLY the event type and an optional reference id.
 * There is deliberately no `amount` field: the amount comes from
 * REWARD_RULES on the server, and earn() re-checks against the database that
 * the event actually happened before crediting anything. Posting
 * {type:"VERIFICATION_COMPLETION"} without a real passing session is a 409,
 * not 50 tokens.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const type = String(body.type ?? "") as TokenType;
  if (!TOKEN_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${TOKEN_TYPES.join(", ")}`, code: "UNKNOWN_TYPE" },
      { status: 400 },
    );
  }

  // Reject an attempt to dictate the payout rather than silently ignoring it.
  if (body.amount !== undefined) {
    return NextResponse.json(
      { error: "amount is server-controlled and cannot be supplied by the client", code: "AMOUNT_NOT_ACCEPTED" },
      { status: 400 },
    );
  }

  const referenceId = typeof body.referenceId === "string" ? body.referenceId : undefined;

  try {
    const result = earn(id, type, referenceId);
    return NextResponse.json(result, { status: result.awarded ? 201 : 200 });
  } catch (err) {
    if (err instanceof TokenError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}

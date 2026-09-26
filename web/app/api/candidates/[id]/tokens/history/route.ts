import { NextResponse } from "next/server";
import { history, TokenError } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/candidates/[id]/tokens/history?limit=&offset= */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  try {
    const { transactions, total } = history(id, Number.isFinite(limit) ? limit : 50, Number.isFinite(offset) ? offset : 0);
    return NextResponse.json({ transactions, total, limit, offset });
  } catch (err) {
    if (err instanceof TokenError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}

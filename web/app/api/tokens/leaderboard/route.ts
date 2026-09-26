import { NextResponse } from "next/server";
import { leaderboard } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tokens/leaderboard?limit= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  return NextResponse.json({ leaderboard: leaderboard(Number.isFinite(limit) ? limit : 20) });
}

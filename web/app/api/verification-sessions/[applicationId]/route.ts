import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await ctx.params;
  const db = getDb();

  const row = db.prepare("SELECT * FROM verification_sessions WHERE applicationId = ?").get(applicationId) as
    | Record<string, unknown>
    | undefined;

  if (!row) return NextResponse.json({ session: null, verified: false });

  return NextResponse.json({
    verified: true,
    session: {
      id: String(row.id),
      applicationId: String(row.applicationId),
      gazeScore: row.gazeScore === null ? null : Number(row.gazeScore),
      lipSyncScore: row.lipSyncScore === null ? null : Number(row.lipSyncScore),
      audioScore: row.audioScore === null ? null : Number(row.audioScore),
      fusedScore: row.fusedScore === null ? null : Number(row.fusedScore),
      result: String(row.result),
      reviewedByHR: Boolean(row.reviewedByHR),
      reasons: JSON.parse(String(row.reasons ?? "[]")),
      createdAt: String(row.createdAt),
    },
  });
}

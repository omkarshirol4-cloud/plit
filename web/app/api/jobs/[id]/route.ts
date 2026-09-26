import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseJsonArray, type Job } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const applicantCount = (
    db.prepare("SELECT COUNT(*) AS n FROM applications WHERE jobId = ?").get(id) as { n: number }
  ).n;

  const job: Job = {
    id: String(row.id),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    requiredSkills: parseJsonArray(row.requiredSkills),
    status: String(row.status),
    createdAt: String(row.createdAt),
  };

  return NextResponse.json({ job, applicantCount });
}

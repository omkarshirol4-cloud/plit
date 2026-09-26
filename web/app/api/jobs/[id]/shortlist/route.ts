import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseJsonArray, type RankedCandidate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id]/shortlist
 *
 * The recruiter's ranked view: ShortlistResult joined to candidate +
 * verification session. Reads only -- ranking is produced by
 * POST /api/shortlist.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;
  const db = getDb();

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Record<string, unknown> | undefined;
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const rows = db
    .prepare(
      `SELECT s.*, a.candidateId, c.name, c.email, c.headline, c.resumeName, c.resumePath,
              v.result AS vResult, v.gazeScore, v.lipSyncScore, v.audioScore,
              v.fusedScore, v.reviewedByHR, v.reasons, v.createdAt AS vCreatedAt
       FROM shortlist_results s
       JOIN applications a ON a.id = s.applicationId
       JOIN candidates c ON c.id = a.candidateId
       LEFT JOIN verification_sessions v ON v.applicationId = a.id
       WHERE s.jobId = ?
       ORDER BY s.rank ASC`,
    )
    .all(jobId) as Record<string, unknown>[];

  const unranked = (
    db
      .prepare(
        `SELECT a.id AS applicationId, c.name, c.resumePath
         FROM applications a
         JOIN candidates c ON c.id = a.candidateId
         LEFT JOIN shortlist_results s ON s.applicationId = a.id AND s.jobId = a.jobId
         WHERE a.jobId = ? AND s.id IS NULL
         ORDER BY a.createdAt ASC`,
      )
      .all(jobId) as Record<string, unknown>[]
  ).map((r) => ({
    applicationId: String(r.applicationId),
    name: String(r.name),
    hasResume: Boolean(r.resumePath),
  }));

  const ranked: RankedCandidate[] = rows.map((r) => ({
    rank: Number(r.rank),
    applicationId: String(r.applicationId),
    candidateId: String(r.candidateId),
    name: String(r.name),
    email: String(r.email),
    headline: String(r.headline ?? ""),
    resumeName: (r.resumeName as string | null) ?? null,
    hasResume: Boolean(r.resumePath),
    resumeScore: Number(r.resumeScore),
    skillsScore: Number(r.skillsScore),
    tfidfScore: Number(r.tfidfScore),
    rankScore: Number(r.rankScore),
    matchedSkills: parseJsonArray(r.matchedSkills),
    missingSkills: parseJsonArray(r.missingSkills),
    verificationMultiplier: Number(r.verificationMultiplier),
    verification: {
      result: (r.vResult as RankedCandidate["verification"]["result"]) ?? null,
      gazeScore: r.gazeScore === null ? null : Number(r.gazeScore),
      lipSyncScore: r.lipSyncScore === null ? null : Number(r.lipSyncScore),
      audioScore: r.audioScore === null ? null : Number(r.audioScore),
      fusedScore: r.fusedScore === null ? null : Number(r.fusedScore),
      reviewedByHR: Boolean(r.reviewedByHR),
      reasons: parseJsonArray(r.reasons),
      createdAt: (r.vCreatedAt as string | null) ?? null,
    },
  }));

  const applicantCount = (
    db.prepare("SELECT COUNT(*) AS n FROM applications WHERE jobId = ?").get(jobId) as { n: number }
  ).n;

  return NextResponse.json({
    job: {
      id: String(job.id),
      title: String(job.title),
      company: String(job.company),
      location: String(job.location ?? ""),
      requiredSkills: parseJsonArray(job.requiredSkills),
    },
    applicantCount,
    rankedAt: rows.length ? String(rows[0].createdAt) : null,
    ranked,
    notYetRanked: unranked,
  });
}

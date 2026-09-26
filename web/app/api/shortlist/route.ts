import { NextResponse } from "next/server";
import { getDb, newId, nowIso } from "@/lib/db";
import { MlServiceError, runShortlist } from "@/lib/ml";
import { parseJsonArray } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shortlist  { jobId }
 *
 * Recruiter-triggered. Pulls the job's applicant pool out of SQLite,
 * hands it to the pre-built resume-screening service, and persists the
 * ranked rows as ShortlistResult. Re-running replaces the previous
 * ranking, so the recruiter can re-rank after a new candidate applies.
 */
export async function POST(req: Request) {
  let jobId = "";
  try {
    const body = (await req.json()) as Record<string, unknown>;
    jobId = String(body.jobId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "body must be JSON with a jobId" }, { status: 400 });
  }
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Record<string, unknown> | undefined;
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const requiredSkills = parseJsonArray(job.requiredSkills);

  const rows = db
    .prepare(
      `SELECT a.id AS applicationId, a.candidateId, c.name, c.resumeText, v.result AS verificationResult
       FROM applications a
       JOIN candidates c ON c.id = a.candidateId
       LEFT JOIN verification_sessions v ON v.applicationId = a.id
       WHERE a.jobId = ?
       ORDER BY a.createdAt ASC`,
    )
    .all(jobId) as Record<string, unknown>[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "nobody has applied to this job yet" }, { status: 409 });
  }

  const noResume = rows.filter((r) => !String(r.resumeText ?? "").trim()).map((r) => String(r.name));
  if (noResume.length === rows.length) {
    return NextResponse.json(
      { error: "none of the applicants have a parsed resume on file -- ask them to upload one first" },
      { status: 409 },
    );
  }

  let ranked;
  try {
    ranked = await runShortlist(
      jobId,
      requiredSkills,
      rows.map((r) => ({
        applicationId: String(r.applicationId),
        candidateId: String(r.candidateId),
        name: String(r.name),
        resumeText: String(r.resumeText ?? ""),
        verificationResult: (r.verificationResult as string | null) ?? null,
      })),
    );
  } catch (err) {
    if (err instanceof MlServiceError) {
      return NextResponse.json({ error: err.message, service: err.service }, { status: 502 });
    }
    throw err;
  }

  // Replace the previous ranking in one transaction so a partially-written
  // shortlist can never be shown to a recruiter.
  const wipe = db.prepare("DELETE FROM shortlist_results WHERE jobId = ?");
  const insert = db.prepare(
    `INSERT INTO shortlist_results
       (id, jobId, applicationId, rank, resumeScore, skillsScore, tfidfScore, rankScore,
        matchedSkills, missingSkills, verificationMultiplier, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = nowIso();
  db.exec("BEGIN");
  try {
    wipe.run(jobId);
    for (const r of ranked) {
      insert.run(
        newId("sl"),
        jobId,
        r.applicationId,
        r.rank,
        r.resumeScore,
        r.skillsScore,
        r.tfidfScore,
        r.rankScore,
        JSON.stringify(r.matchedSkills ?? []),
        JSON.stringify(r.missingSkills ?? []),
        r.verificationMultiplier,
        createdAt,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return NextResponse.json({
    jobId,
    requiredSkills,
    rankedCount: ranked.length,
    skippedNoResume: noResume,
    results: ranked,
  });
}

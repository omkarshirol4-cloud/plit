import { NextResponse } from "next/server";
import { getDb, newId, nowIso } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const candidateId = url.searchParams.get("candidateId");
  const jobId = url.searchParams.get("jobId");

  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (candidateId) {
    where.push("a.candidateId = ?");
    params.push(candidateId);
  }
  if (jobId) {
    where.push("a.jobId = ?");
    params.push(jobId);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT a.*, c.name AS candidateName, j.title AS jobTitle, j.company AS jobCompany,
              v.result AS verificationResult,
              s.rankScore AS screeningRankScore,
              s.verificationMultiplier AS screeningMultiplier
       FROM applications a
       JOIN candidates c ON c.id = a.candidateId
       JOIN jobs j ON j.id = a.jobId
       LEFT JOIN verification_sessions v ON v.applicationId = a.id
       LEFT JOIN shortlist_results s ON s.applicationId = a.id
       ${clause}
       ORDER BY a.createdAt DESC`,
    )
    .all(...params) as Record<string, unknown>[];

  return NextResponse.json({
    applications: rows.map((r) => ({
      id: String(r.id),
      candidateId: String(r.candidateId),
      candidateName: String(r.candidateName),
      jobId: String(r.jobId),
      jobTitle: String(r.jobTitle),
      jobCompany: String(r.jobCompany),
      note: String(r.note ?? ""),
      status: String(r.status),
      createdAt: String(r.createdAt),
      verificationResult: (r.verificationResult as string | null) ?? null,
      // Real screening output, or null when this application has not been
      // screened yet. Read-only: this surfaces what screening already stored
      // and never influences it.
      screeningRankScore: (r.screeningRankScore as number | null) ?? null,
      screeningMultiplier: (r.screeningMultiplier as number | null) ?? null,
    })),
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const candidateId = String(body.candidateId ?? "").trim();
  const jobId = String(body.jobId ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!candidateId || !jobId) {
    return NextResponse.json({ error: "candidateId and jobId are required" }, { status: 400 });
  }

  const db = getDb();
  const candidate = db.prepare("SELECT id, name, resumePath FROM candidates WHERE id = ?").get(candidateId) as
    | { id: string; name: string; resumePath: string | null }
    | undefined;
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const job = db.prepare("SELECT id, status FROM jobs WHERE id = ?").get(jobId) as
    | { id: string; status: string }
    | undefined;
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  if (job.status !== "open") {
    return NextResponse.json({ error: "this job is no longer accepting applications" }, { status: 409 });
  }

  const existing = db
    .prepare("SELECT id FROM applications WHERE candidateId = ? AND jobId = ?")
    .get(candidateId, jobId) as { id: string } | undefined;
  if (existing) {
    return NextResponse.json({ error: "you have already applied to this job", applicationId: existing.id }, { status: 409 });
  }

  const application = {
    id: newId("app"),
    candidateId,
    jobId,
    note,
    status: "submitted",
    createdAt: nowIso(),
  };

  db.prepare(
    "INSERT INTO applications (id, candidateId, jobId, note, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(application.id, application.candidateId, application.jobId, application.note, application.status, application.createdAt);

  return NextResponse.json(
    { application, warning: candidate.resumePath ? undefined : "no resume on file -- upload one to be ranked" },
    { status: 201 },
  );
}

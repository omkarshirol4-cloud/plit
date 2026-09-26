import { NextResponse } from "next/server";
import { getDb, newId, nowIso } from "@/lib/db";
import { parseJsonArray, type Job } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function toJob(row: Row): Job & { applicantCount: number } {
  return {
    id: String(row.id),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    requiredSkills: parseJsonArray(row.requiredSkills),
    status: String(row.status),
    createdAt: String(row.createdAt),
    applicantCount: Number(row.applicantCount ?? 0),
  };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.jobId = j.id) AS applicantCount
       FROM jobs j ORDER BY j.createdAt DESC`,
    )
    .all() as Row[];
  return NextResponse.json({ jobs: rows.map(toJob) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const company = String(body.company ?? "").trim();
  const location = String(body.location ?? "").trim();
  const description = String(body.description ?? "").trim();
  const requiredSkills = Array.isArray(body.requiredSkills)
    ? body.requiredSkills.map(String).map((s) => s.trim()).filter(Boolean)
    : String(body.requiredSkills ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 });
  if (requiredSkills.length === 0) {
    return NextResponse.json(
      { error: "at least one required skill is needed -- the screening service ranks on them" },
      { status: 400 },
    );
  }

  const db = getDb();
  const job = {
    id: newId("job"),
    title,
    company,
    location,
    description,
    requiredSkills,
    status: "open",
    createdAt: nowIso(),
  };

  db.prepare(
    `INSERT INTO jobs (id, title, company, location, description, requiredSkills, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(job.id, job.title, job.company, job.location, job.description, JSON.stringify(job.requiredSkills), job.status, job.createdAt);

  return NextResponse.json({ job: { ...job, applicantCount: 0 } }, { status: 201 });
}

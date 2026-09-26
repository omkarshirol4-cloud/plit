import { NextResponse } from "next/server";
import { getDb, newId, nowIso } from "@/lib/db";
import { parseJsonArray, type Candidate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function toCandidate(row: Row): Candidate {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    headline: String(row.headline ?? ""),
    skills: parseJsonArray(row.skills),
    resumePath: (row.resumePath as string | null) ?? null,
    resumeName: (row.resumeName as string | null) ?? null,
    resumeText: (row.resumeText as string | null) ?? null,
    createdAt: String(row.createdAt),
  };
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM candidates ORDER BY createdAt DESC").all() as Row[];
  return NextResponse.json({ candidates: rows.map(toCandidate) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const headline = String(body.headline ?? "").trim();
  const skills = Array.isArray(body.skills)
    ? body.skills.map(String).map((s) => s.trim()).filter(Boolean)
    : String(body.skills ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "a valid email is required" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM candidates WHERE email = ?").get(email) as Row | undefined;
  if (existing) {
    return NextResponse.json({ error: "a candidate with that email already exists" }, { status: 409 });
  }

  const candidate: Candidate = {
    id: newId("cand"),
    name,
    email,
    headline,
    skills,
    resumePath: null,
    resumeName: null,
    resumeText: null,
    createdAt: nowIso(),
  };

  db.prepare(
    `INSERT INTO candidates (id, name, email, headline, skills, resumePath, resumeName, resumeText, createdAt)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
  ).run(candidate.id, candidate.name, candidate.email, candidate.headline, JSON.stringify(candidate.skills), candidate.createdAt);

  return NextResponse.json({ candidate }, { status: 201 });
}

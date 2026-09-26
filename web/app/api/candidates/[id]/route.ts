import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseJsonArray, type Candidate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const candidate: Candidate = {
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

  const applications = db
    .prepare("SELECT * FROM applications WHERE candidateId = ? ORDER BY createdAt DESC")
    .all(id);

  return NextResponse.json({ candidate, applications });
}

/** Edit the mutable parts of a profile. Email is the identity key, so it's fixed. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();

  const existing = db.prepare("SELECT id FROM candidates WHERE id = ?").get(id);
  if (!existing) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const headline = body.headline === undefined ? undefined : String(body.headline).trim();
  const skills =
    body.skills === undefined
      ? undefined
      : (Array.isArray(body.skills)
          ? body.skills.map(String)
          : String(body.skills).split(",")
        )
          .map((s) => s.trim())
          .filter(Boolean);

  if (headline === undefined && skills === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  if (headline !== undefined) db.prepare("UPDATE candidates SET headline = ? WHERE id = ?").run(headline, id);
  if (skills !== undefined) {
    db.prepare("UPDATE candidates SET skills = ? WHERE id = ?").run(JSON.stringify(skills), id);
  }

  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    candidate: {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      headline: String(row.headline ?? ""),
      skills: parseJsonArray(row.skills),
      resumePath: (row.resumePath as string | null) ?? null,
      resumeName: (row.resumeName as string | null) ?? null,
      resumeText: (row.resumeText as string | null) ?? null,
      createdAt: String(row.createdAt),
    },
  });
}

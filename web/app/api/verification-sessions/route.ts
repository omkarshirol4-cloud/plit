import { NextResponse } from "next/server";
import { getDb, newId, nowIso } from "@/lib/db";
import type { VerificationResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/verification-sessions
 *
 * Called by the pre-built ML service (ml/verification/service.py) after it
 * runs the gaze / lip-sync / audio pipeline. The payload shape is fixed by
 * that service -- see `to_verification_session_payload` in
 * ml/verification/fusion.py. Field names must not drift.
 *
 *   { submissionId, gazeScore, lipSyncScore, audioScore, result, reviewedByHR }
 *
 * `submissionId` is the Application id. The service strips its own
 * underscore-prefixed diagnostic keys (`_fusedScore`, `_reasons`) before
 * POSTing, so we accept them if present but never require them.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const submissionId = String(body.submissionId ?? "").trim();
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const result = String(body.result ?? "") as VerificationResult;
  if (result !== "pass" && result !== "flagged" && result !== "fail") {
    return NextResponse.json(
      { error: `result must be one of pass|flagged|fail, got ${JSON.stringify(body.result)}` },
      { status: 400 },
    );
  }

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const db = getDb();
  const application = db.prepare("SELECT id, candidateId, jobId FROM applications WHERE id = ?").get(submissionId) as
    | { id: string; candidateId: string; jobId: string }
    | undefined;
  if (!application) {
    return NextResponse.json({ error: `no application with id ${submissionId}` }, { status: 404 });
  }

  const existing = db.prepare("SELECT id FROM verification_sessions WHERE applicationId = ?").get(submissionId) as
    | { id: string }
    | undefined;
  if (existing) {
    return NextResponse.json(
      { error: "a verification session already exists for this application", id: existing.id },
      { status: 409 },
    );
  }

  const reasons = Array.isArray(body._reasons) ? body._reasons.map(String) : [];

  const id = newId("vs");
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO verification_sessions
       (id, applicationId, gazeScore, lipSyncScore, audioScore, fusedScore, result, reviewedByHR, reasons, rawSignals, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    submissionId,
    num(body.gazeScore),
    num(body.lipSyncScore),
    num(body.audioScore),
    num(body._fusedScore),
    result,
    body.reviewedByHR ? 1 : 0,
    JSON.stringify(reasons),
    JSON.stringify({
      gazeScore: num(body.gazeScore),
      lipSyncScore: num(body.lipSyncScore),
      audioScore: num(body.audioScore),
    }),
    createdAt,
  );

  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(
    result === "pass" ? "verified" : "verification_flagged",
    submissionId,
  );

  return NextResponse.json(
    { id, applicationId: submissionId, result, reviewedByHR: Boolean(body.reviewedByHR), createdAt },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const applicationId = url.searchParams.get("applicationId");
  const db = getDb();

  const rows = (
    applicationId
      ? db.prepare("SELECT * FROM verification_sessions WHERE applicationId = ?").all(applicationId)
      : db.prepare("SELECT * FROM verification_sessions ORDER BY createdAt DESC").all()
  ) as Record<string, unknown>[];

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: String(r.id),
      applicationId: String(r.applicationId),
      gazeScore: r.gazeScore === null ? null : Number(r.gazeScore),
      lipSyncScore: r.lipSyncScore === null ? null : Number(r.lipSyncScore),
      audioScore: r.audioScore === null ? null : Number(r.audioScore),
      fusedScore: r.fusedScore === null ? null : Number(r.fusedScore),
      result: String(r.result),
      reviewedByHR: Boolean(r.reviewedByHR),
      reasons: JSON.parse(String(r.reasons ?? "[]")),
      createdAt: String(r.createdAt),
    })),
  });
}

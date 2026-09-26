import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MlServiceError, runVerification } from "@/lib/ml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXT = [".webm", ".mp4", ".mov", ".mkv", ".avi", ".webm"];

/**
 * POST /api/applications/[id]/verify   (multipart: `clip`)
 *
 * Browser records a webcam+mic clip -> we forward it to the pre-built
 * verification service on :8001. That service scores gaze/lip-sync/audio,
 * fuses them, and POSTs the canonical VerificationSession payload back to
 * /api/verification-sessions, which is what actually persists the row.
 *
 * So by the time this handler returns, the session is already stored; we
 * re-read it from SQLite instead of trusting the service's echo.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await ctx.params;
  const db = getDb();

  const application = db.prepare("SELECT id FROM applications WHERE id = ?").get(applicationId) as
    | { id: string }
    | undefined;
  if (!application) return NextResponse.json({ error: "application not found" }, { status: 404 });

  const existing = db.prepare("SELECT id FROM verification_sessions WHERE applicationId = ?").get(applicationId) as
    | { id: string }
    | undefined;
  if (existing) {
    return NextResponse.json({ error: "this application has already been verified" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data with a `clip` field" }, { status: 400 });
  }

  const clip = form.get("clip");
  if (!(clip instanceof File)) {
    return NextResponse.json({ error: "no `clip` field in the request" }, { status: 400 });
  }
  if (clip.size === 0) return NextResponse.json({ error: "recorded clip is empty" }, { status: 400 });
  if (clip.size > MAX_BYTES) {
    return NextResponse.json({ error: `clip is too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const filename = clip.name || "clip.webm";
  if (!ALLOWED_EXT.some((e) => filename.toLowerCase().endsWith(e))) {
    return NextResponse.json(
      { error: `unsupported clip type ${filename} — expected one of: ${[...new Set(ALLOWED_EXT)].join(", ")}` },
      { status: 415 },
    );
  }

  let serviceResponse: Record<string, unknown>;
  try {
    serviceResponse = await runVerification(applicationId, clip, filename);
  } catch (err) {
    if (err instanceof MlServiceError) {
      return NextResponse.json({ error: err.message, service: err.service }, { status: 502 });
    }
    throw err;
  }

  // The service posts to /api/verification-sessions itself. If that
  // round-trip failed (e.g. it booted without BACKEND_BASE_URL pointing
  // here), surface that loudly rather than reporting a phantom success.
  let stored = db
    .prepare("SELECT * FROM verification_sessions WHERE applicationId = ?")
    .get(applicationId) as Record<string, unknown> | undefined;

  if (!stored) {
    return NextResponse.json(
      {
        error:
          "the verification service scored the clip but could not save the result. " +
          "Check that it was started with BACKEND_BASE_URL=http://localhost:3000",
        serviceResponse,
      },
      { status: 502 },
    );
  }

  // service.py strips "_"-prefixed keys before POSTing (line 75), so
  // _fusedScore and _reasons never arrive on the wire. Its *return* value
  // is unstripped though, so backfill from there rather than recomputing
  // the fusion ourselves -- the weights live in the ML service's fusion.py
  // and must stay authoritative there.
  const echoed = (serviceResponse.sent_to_backend ?? {}) as Record<string, unknown>;
  if (stored.fusedScore === null && typeof echoed._fusedScore === "number") {
    const reasons = Array.isArray(echoed._reasons) ? echoed._reasons.map(String) : [];
    db.prepare("UPDATE verification_sessions SET fusedScore = ?, reasons = ? WHERE id = ?").run(
      echoed._fusedScore,
      JSON.stringify(reasons),
      String(stored.id),
    );
    stored = db
      .prepare("SELECT * FROM verification_sessions WHERE applicationId = ?")
      .get(applicationId) as Record<string, unknown>;
  }

  return NextResponse.json({
    session: {
      id: String(stored.id),
      applicationId,
      gazeScore: stored.gazeScore === null ? null : Number(stored.gazeScore),
      lipSyncScore: stored.lipSyncScore === null ? null : Number(stored.lipSyncScore),
      audioScore: stored.audioScore === null ? null : Number(stored.audioScore),
      fusedScore: stored.fusedScore === null ? null : Number(stored.fusedScore),
      result: String(stored.result),
      reviewedByHR: Boolean(stored.reviewedByHR),
      reasons: JSON.parse(String(stored.reasons ?? "[]")),
      createdAt: String(stored.createdAt),
    },
    diagnostics: serviceResponse.diagnostics ?? null,
    backendStatus: serviceResponse.backend_status ?? null,
  });
}

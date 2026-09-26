import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness for the demo: are both Python ML services actually up? */
export async function GET() {
  const db = getDb();
  const counts = {
    candidates: (db.prepare("SELECT COUNT(*) AS n FROM candidates").get() as { n: number }).n,
    jobs: (db.prepare("SELECT COUNT(*) AS n FROM jobs").get() as { n: number }).n,
    applications: (db.prepare("SELECT COUNT(*) AS n FROM applications").get() as { n: number }).n,
    shortlistResults: (db.prepare("SELECT COUNT(*) AS n FROM shortlist_results").get() as { n: number }).n,
    verificationSessions: (db.prepare("SELECT COUNT(*) AS n FROM verification_sessions").get() as { n: number }).n,
  };

  const probe = async (url: string) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      return res.ok ? "ok" : `http ${res.status}`;
    } catch (err) {
      return `unreachable (${(err as Error).message})`;
    }
  };

  const [verification, screening] = await Promise.all([
    probe(process.env.ML_HEALTH_VERIFY ?? "http://localhost:8001/health"),
    probe(process.env.ML_HEALTH_SCREENING ?? "http://localhost:8002/health"),
  ]);

  return NextResponse.json({ ok: true, counts, services: { verification, screening } });
}

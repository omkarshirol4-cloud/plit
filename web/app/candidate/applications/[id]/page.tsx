"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { NotVerifiedYet, VerificationResultCard } from "@/components/VerificationResultCard";
import { ErrorState } from "@/components/ui";
import { DetailSkeleton } from "@/components/Skeletons";
import { getJson } from "@/lib/session";
import type { ApplicationRow } from "@/lib/candidate-data";
import type { VerificationSession } from "@/lib/types";

/**
 * /candidate/applications/[id] — the full record for one application.
 *
 * Composed from the existing endpoints: the application row for status and
 * screening, and the stored verification session for the signal breakdown.
 */
export default function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = use(params);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [apps, v] = await Promise.all([
          getJson<{ applications: ApplicationRow[] }>("/api/applications"),
          getJson<{ session: VerificationSession | null }>(`/api/verification-sessions/${encodeURIComponent(applicationId)}`),
        ]);
        if (cancelled) return;
        setApplication((apps.applications ?? []).find((a) => a.id === applicationId) ?? null);
        setSession(v.session);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (loading) return <DetailSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (!application) {
    return (
      <div className="panel">
        <h1>Application not found</h1>
        <p className="muted">No application with that id exists.</p>
        <Link href="/candidate/applications">
          <button>Back to applications</button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{application.jobTitle}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {application.jobCompany}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/applications">
            <button className="secondary small">All applications</button>
          </Link>
        </div>
      </div>

      <div className="section grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Application</h2>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-sub">Status</div>
            </div>
            <div className="mono small">{application.status}</div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-sub">Applied</div>
            </div>
            <div className="mono small">{new Date(application.createdAt).toLocaleString()}</div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-sub">AI Match Score</div>
            </div>
            <div className="mono small">
              {application.screeningRankScore === null
                ? "awaiting screening"
                : `${application.screeningRankScore.toFixed(3)}${
                    application.screeningMultiplier !== null
                      ? ` × ${application.screeningMultiplier.toFixed(2)}`
                      : ""
                  }`}
            </div>
          </div>
          <p className="muted small" style={{ margin: "12px 0 0" }}>
            A score appears only once the screening service has scored this application. Tokens never affect it.
          </p>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Verification</h2>
          {session ? (
            <VerificationResultCard session={session} />
          ) : (
            <NotVerifiedYet applicationId={applicationId} />
          )}
        </div>
      </div>
    </>
  );
}

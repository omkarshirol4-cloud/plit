"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { VerificationRecorder } from "@/components/VerificationRecorder";
import { VerificationResultCard } from "@/components/VerificationResultCard";
import { EmptyState, ErrorState, NoCandidate, VerificationPill, formatDateTime } from "@/components/ui";
import { VerificationSkeleton, DetailSkeleton } from "@/components/Skeletons";
import { useCandidateBundle } from "@/lib/candidate-data";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { VerificationSession } from "@/lib/types";

/**
 * /candidate/verification — the one place verification happens.
 *
 * Left: every application with its real verification state. Right: the recorder
 * for the selected application, or the stored result for one already recorded.
 * The legacy /candidate/verify/[id] URL redirects here.
 */
export default function VerificationPage() {
  return (
    <Suspense fallback={<VerificationSkeleton />}>
      <VerificationHub />
    </Suspense>
  );
}

function VerificationHub() {
  const [candidateId, , ready] = useCandidateId();
  const { data, error, loading, reload } = useCandidateBundle(candidateId, ready);
  const params = useSearchParams();
  const selectedId = params.get("app");

  const [session, setSession] = useState<VerificationSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const apps = data?.applications ?? [];
  const selected = apps.find((a) => a.id === selectedId) ?? null;

  // Fetch the stored session whenever the selected application changes.
  useEffect(() => {
    if (!selectedId) {
      setSession(null);
      return;
    }
    let cancelled = false;
    setSessionLoading(true);
    getJson<{ session: VerificationSession | null }>(
      `/api/verification-sessions/${encodeURIComponent(selectedId)}`,
    )
      .then((d) => {
        if (!cancelled) setSession(d.session);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!ready) return <VerificationSkeleton />;
  if (!candidateId)
    return (
      <>
        <h1>Verification</h1>
        <NoCandidate what="verification" />
      </>
    );
  if (loading) return <VerificationSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const pending = apps.filter((a) => !a.verificationResult);
  const done = apps.filter((a) => a.verificationResult);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Verification</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Prove you are really you. Gaze, lip-sync and audio are scored by the verification service, and a pass
            multiplies your AI screening score. A flag routes to a human reviewer instead of rejecting you.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/applications">
            <button className="secondary small">My applications</button>
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="You have no applications to verify yet."
            hint="Apply to a job first, then come back and record a clip for that application."
          />
          <div style={{ textAlign: "center" }}>
            <Link href="/candidate/jobs">
              <button>Browse jobs</button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="section verify-shell">
          <div>
            <h2 style={{ marginTop: 0 }}>Select an application</h2>

            {pending.length > 0 && (
              <>
                <h3>Needs verification</h3>
                <div className="panel" style={{ padding: 0 }}>
                  {pending.map((a) => (
                    <div className="list-row" key={a.id}>
                      <div className="list-row-main">
                        <div className="list-row-title">{a.jobTitle}</div>
                        <div className="list-row-sub">
                          {a.jobCompany} · applied {formatDateTime(a.createdAt)}
                        </div>
                      </div>
                      <div className="row">
                        <VerificationPill result={a.verificationResult} />
                        <Link href={`/candidate/verification?app=${a.id}`}>
                          <button className="small">Record clip</button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {done.length > 0 && (
              <>
                <h3>Verified</h3>
                <div className="panel" style={{ padding: 0 }}>
                  {done.map((a) => (
                    <div className="list-row" key={a.id}>
                      <div className="list-row-main">
                        <div className="list-row-title">{a.jobTitle}</div>
                        <div className="list-row-sub">{a.jobCompany}</div>
                      </div>
                      <div className="row">
                        <VerificationPill result={a.verificationResult} />
                        <Link href={`/candidate/verification?app=${a.id}`}>
                          <button className="secondary small">View result</button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            {selected ? (
              <>
                <h2 style={{ marginTop: 0 }}>{selected.jobTitle}</h2>
                {sessionLoading ? (
                  <DetailSkeleton />
                ) : session ? (
                  <VerificationResultCard
                    session={session}
                    actions={
                      <>
                        <Link href={`/candidate/applications/${session.applicationId}`}>
                          <button className="secondary small">Full application record</button>
                        </Link>
                        <Link href={`/candidate/verification?app=${session.applicationId}`}>
                          <button className="small">Record a new clip</button>
                        </Link>
                      </>
                    }
                  />
                ) : (
                  <VerificationRecorder
                    applicationId={selected.id}
                    jobTitle={selected.jobTitle}
                    onComplete={() => reload()}
                  />
                )}
              </>
            ) : (
              <div className="panel">
                <EmptyState
                  title="Pick an application to the left."
                  hint="The camera flow and its stored result both appear here."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

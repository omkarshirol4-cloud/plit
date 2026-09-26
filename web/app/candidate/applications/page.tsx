"use client";

import Link from "next/link";
import { ApplicationRowView } from "@/components/candidate-cards";
import { EmptyState, ErrorState, Loading, NoCandidate } from "@/components/ui";
import { useCandidateBundle } from "@/lib/candidate-data";
import { useCandidateId } from "@/lib/client";

/**
 * /candidate/applications — one row per application, with the real screening
 * result and verification state side by side.
 *
 * The score cell comes from the shared label helper, so "awaiting screening"
 * and a real number can never be confused.
 */
export default function MyApplications() {
  const [candidateId, , ready] = useCandidateId();
  const { data, error, loading, reload } = useCandidateBundle(candidateId, ready);

  if (!ready) return <Loading label="Loading applications" />;
  if (!candidateId)
    return (
      <>
        <h1>Your applications</h1>
        <NoCandidate what="your applications" />
      </>
    );
  if (loading) return <Loading label="Loading applications" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading applications" />;

  const apps = data.applications;
  const awaiting = apps.filter((a) => a.screeningRankScore === null).length;
  const verified = apps.filter((a) => a.verificationResult === "pass").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your applications</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {apps.length} total · {awaiting} awaiting screening · {verified} verified
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/jobs">
            <button className="small">Browse jobs</button>
          </Link>
        </div>
      </div>

      <div className="section">
        {apps.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="You have not applied to anything yet."
              hint="Apply to a role and its screening score will show up here."
            />
            <div style={{ textAlign: "center" }}>
              <Link href="/candidate/jobs">
                <button>Browse open roles</button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>AI Match Score</th>
                    <th>Verification</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <ApplicationRowView key={a.id} a={a} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ margin: "14px 0 0" }}>
              Scores appear once the screening service has run on your application. Verification multiplies that
              score. Tokens are engagement rewards and never affect ranking.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

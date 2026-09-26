"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ScoreBreakdown } from "@/components/RankedCandidateTable";
import { RoleGate } from "@/components/TopNav";
import { NotVerifiedYet, VerificationResultCard } from "@/components/VerificationResultCard";
import { ErrorState, StatCard, StatusPill, formatDate } from "@/components/ui";
import { ProfileSkeleton } from "@/components/Skeletons";
import { getJson } from "@/lib/session";
import type { ApplicationRow } from "@/lib/candidate-data";
import type { JobRow } from "@/lib/candidate-data";
import type { RankedCandidate, VerificationSession } from "@/lib/types";

type ShortlistResponse = {
  job: { id: string; title: string; company: string; location: string; requiredSkills: string[] };
  ranked: RankedCandidate[];
  notYetRanked: { applicationId: string; name: string; hasResume: boolean }[];
};

/**
 * /recruiter/candidates/[applicationId] — one applicant's full record.
 *
 * Keyed by application, not candidate, because the same person can apply to
 * several roles and each application has its own screening and verification
 * state. Composed from the existing applications, shortlist and verification
 * endpoints; nothing is recomputed here.
 */
export default function RecruiterCandidateDetail({ params }: { params: Promise<{ applicationId: string }> }) {
  return (
    <RoleGate need="recruiter">
      <RecruiterCandidateInner params={params} />
    </RoleGate>
  );
}

function RecruiterCandidateInner({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = use(params);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistResponse | null>(null);
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const apps = await getJson<{ applications: ApplicationRow[] }>("/api/applications");
        const app = (apps.applications ?? []).find((a) => a.id === applicationId) ?? null;
        if (cancelled) return;
        setApplication(app);

        if (!app) {
          setLoading(false);
          return;
        }

        const allJobs = await getJson<{ jobs: JobRow[] }>("/api/jobs");
        if (cancelled) return;
        setJob((allJobs.jobs ?? []).find((j) => j.id === app.jobId) ?? null);

        const [sl, v] = await Promise.all([
          getJson<ShortlistResponse>(`/api/jobs/${encodeURIComponent(app.jobId)}/shortlist`),
          getJson<{ session: VerificationSession | null }>(`/api/verification-sessions/${encodeURIComponent(applicationId)}`),
        ]);
        if (cancelled) return;
        setShortlist(sl);
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

  if (loading) return <ProfileSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (!application) {
    return (
      <div className="panel">
        <h1>Application not found</h1>
        <p className="muted">No application with that id exists.</p>
        <Link href="/recruiter/applicants">
          <button>Back to applicants</button>
        </Link>
      </div>
    );
  }

  const ranked = shortlist?.ranked.find((c) => c.applicationId === applicationId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{application.candidateName}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {job ? `${job.title} · ${job.company}` : application.jobTitle} · applied {formatDate(application.createdAt)}
          </p>
        </div>
        <div className="page-actions">
          <Link href={application.jobId ? `/recruiter/jobs/${application.jobId}` : "/recruiter/shortlists"}>
            <button className="secondary">Back to shortlist</button>
          </Link>
        </div>
      </div>

      <div className="section stat-grid">
        <StatCard
          label="AI Match Score"
          value={application.screeningRankScore === null ? "not screened" : application.screeningRankScore.toFixed(3)}
          sub={
            application.screeningMultiplier === null
              ? "run the shortlist to score"
              : `×${application.screeningMultiplier.toFixed(2)} verification`
          }
          tone={application.screeningRankScore === null ? "warn" : "accent"}
        />
        <StatCard
          label="Shortlist rank"
          value={ranked ? `#${ranked.rank}` : "unranked"}
          sub={ranked ? `of ${shortlist?.ranked.length ?? 0}` : "run the shortlist to rank"}
          tone={ranked ? "ok" : "warn"}
        />
        <StatCard label="Application status" value={application.status} />
        <StatCard
          label="Verification"
          value={application.verificationResult ?? "unverified"}
          tone={
            application.verificationResult === "pass"
              ? "ok"
              : application.verificationResult === null
                ? undefined
                : "warn"
          }
        />
      </div>

      <div className="section grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Screening breakdown</h2>
          {ranked ? (
            <ScoreBreakdown c={ranked} />
          ) : (
            <>
              <p className="muted small">
                This application is not in the stored ranking for {application.jobTitle}. It has
                {application.screeningRankScore === null
                  ? " never been screened."
                  : ` a stored score of ${application.screeningRankScore.toFixed(3)} but no current ranking row.`}{" "}
                Re-run the shortlist for this role to include them.
              </p>
              <StatusPill status={application.status} />
            </>
          )}
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Verification</h2>
          {session ? (
            <VerificationResultCard session={session} />
          ) : (
            <NotVerifiedYet applicationId={applicationId} />
          )}
          <p className="muted small" style={{ margin: "12px 0 0" }}>
            A flagged result routes to a human reviewer rather than rejecting the candidate. Tokens are engagement
            rewards and are not shown to recruiters because they play no part in ranking.
          </p>
        </div>
      </div>
    </>
  );
}

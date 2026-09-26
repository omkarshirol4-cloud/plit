"use client";

import Link from "next/link";
import { RoleGate } from "@/components/TopNav";
import { EmptyState, ErrorState, Loading, StatCard, VerificationPill, formatDate } from "@/components/ui";
import { rollupByJob, useRecruiterData } from "@/lib/recruiter-data";

/**
 * /recruiter — the recruiter home.
 *
 * Every count is derived client-side from the existing jobs and applications
 * endpoints, so the numbers here can never disagree with the shortlist pages.
 */
export default function RecruiterDashboard() {
  return (
    <RoleGate need="recruiter">
      <RecruiterDashboardInner />
    </RoleGate>
  );
}

function RecruiterDashboardInner() {
  const { data, loading, error, reload } = useRecruiterData();

  if (loading && !data) return <Loading label="Loading dashboard" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading dashboard" />;

  const jobs = rollupByJob(data);
  const apps = data.applications;
  const openJobs = jobs.filter((j) => j.status === "open");
  const awaitingScreening = apps.filter((a) => a.screeningRankScore === null);
  const verified = apps.filter((a) => a.verificationResult === "pass");
  const needsReview = apps.filter((a) => a.verificationResult === "flagged" || a.verificationResult === "fail");
  const jobsWithApplicants = jobs.filter((j) => j.applicants.length > 0);
  const unscreenedJobs = jobsWithApplicants.filter((j) => j.screened === 0);
  const recent = apps.slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recruiter dashboard</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {openJobs.length} open role{openJobs.length === 1 ? "" : "s"} · {apps.length} application
            {apps.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/recruiter/jobs/new">
            <button>Post a job</button>
          </Link>
        </div>
      </div>

      <div className="section stat-grid">
        <StatCard label="Open roles" value={openJobs.length} sub={`${jobs.length} total`} tone="accent" />
        <StatCard label="Applicants" value={apps.length} sub={`${awaitingScreening.length} awaiting screening`} />
        <StatCard label="Verified" value={verified.length} sub="live webcam check passed" tone="ok" />
        <StatCard
          label="Needs review"
          value={needsReview.length}
          sub="flagged or failed verification"
          tone={needsReview.length > 0 ? "warn" : undefined}
        />
      </div>

      {unscreenedJobs.length > 0 && (
        <div className="section">
          <div className="msg info">
            {unscreenedJobs.length} role{unscreenedJobs.length === 1 ? " has" : "s have"} applicants that have not been
            screened yet.{" "}
            {unscreenedJobs.length === 1 ? (
              <Link href={`/recruiter/jobs/${unscreenedJobs[0].id}`}>
                Run the shortlist for {unscreenedJobs[0].title}
              </Link>
            ) : (
              <Link href="/recruiter/shortlists">Review shortlists</Link>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Roles</h2>
          <Link href="/recruiter/shortlists" className="small">
            All shortlists
          </Link>
        </div>
        {jobs.length === 0 ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <EmptyState title="No jobs yet." hint="Post a role to start receiving applications." />
          </div>
        ) : (
          <div className="cards" style={{ marginTop: 12 }}>
            {jobs.slice(0, 6).map((j) => (
              <div className="panel job-card" key={j.id}>
                <div className="job-card-top">
                  <div>
                    <h3>{j.title}</h3>
                    <div className="job-card-meta">
                      {j.company}
                      {j.location ? ` · ${j.location}` : ""} · posted {formatDate(j.createdAt)}
                    </div>
                  </div>
                  {j.status !== "open" ? <span className="badge none">{j.status}</span> : null}
                </div>

                <div>
                  {j.requiredSkills.slice(0, 6).map((s) => (
                    <span className="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>

                <div className="job-card-foot">
                  <span className="muted small">
                    {j.applicants.length} applicant{j.applicants.length === 1 ? "" : "s"} · {j.verified} verified
                    {j.bestRankScore !== null ? ` · top score ${j.bestRankScore.toFixed(3)}` : " · not screened"}
                  </span>
                  <Link href={`/recruiter/jobs/${j.id}`}>
                    <button className="small">{j.screened ? "Shortlist" : "Review"}</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Recent applications</h2>
          <Link href="/recruiter/applicants" className="small">
            All applicants
          </Link>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          {recent.length === 0 ? (
            <EmptyState title="No applications yet." hint="Applicants appear here as candidates apply." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Applied</th>
                    <th>AI Match Score</th>
                    <th>Verification</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div>{a.candidateName}</div>
                      </td>
                      <td className="muted small">{a.jobTitle}</td>
                      <td className="muted small">{formatDate(a.createdAt)}</td>
                      <td>
                        {a.screeningRankScore === null ? (
                          <span className="muted small">awaiting screening</span>
                        ) : (
                          <span className="mono">{a.screeningRankScore.toFixed(3)}</span>
                        )}
                      </td>
                      <td>
                        <VerificationPill result={a.verificationResult} />
                      </td>
                      <td>
                        <Link href={`/recruiter/candidates/${a.id}`}>
                          <button className="secondary small">open</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

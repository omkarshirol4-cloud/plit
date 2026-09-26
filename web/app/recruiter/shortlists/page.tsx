"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/TopNav";
import { DemoBadge, DemoNotice, EmptyState, ErrorState, StatCard, formatDate } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeletons";
import { DEMO_SCORE_NOTE, isDemoId } from "@/lib/demo-marker";
import { rollupByJob, useRecruiterData } from "@/lib/recruiter-data";

/**
 * /recruiter/shortlists — one row per role, with its ranking status.
 *
 * Roles with no applicants are hidden by default because there is nothing to
 * rank. "Screened" is derived from real stored scores, so a role that was
 * ranked before and then got new applicants shows up as needing a re-run.
 */
export default function RecruiterShortlists() {
  return (
    <RoleGate need="recruiter">
      <RecruiterShortlistsInner />
    </RoleGate>
  );
}

function RecruiterShortlistsInner() {
  const { data, loading, error, reload } = useRecruiterData();
  const [showEmpty, setShowEmpty] = useState(false);

  if (loading && !data) return <TableSkeleton rows={5} cols={6} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <TableSkeleton rows={5} cols={6} />;

  const jobs = rollupByJob(data);
  const withApplicants = jobs.filter((j) => j.applicants.length > 0);
  const visible = showEmpty ? jobs : withApplicants;
  const notScreened = withApplicants.filter((j) => j.screened === 0);
  const fullyScreened = withApplicants.filter((j) => j.screened === j.applicants.length);
  const anyDemo = visible.some((j) => isDemoId(j.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shortlists</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {withApplicants.length} role{withApplicants.length === 1 ? "" : "s"} with applicants
          </p>
        </div>
        <div className="page-actions">
          <button className="secondary small" onClick={() => setShowEmpty((v) => !v)} aria-pressed={showEmpty}>
            {showEmpty ? "Hiding roles with no applicants" : "Show roles with no applicants"}
          </button>
        </div>
      </div>

      <div className="section stat-grid">
        <StatCard label="Roles with applicants" value={withApplicants.length} tone="accent" />
        <StatCard label="Fully screened" value={fullyScreened.length} tone="ok" />
        <StatCard
          label="Awaiting shortlist"
          value={notScreened.length}
          tone={notScreened.length ? "warn" : undefined}
        />
        <StatCard
          label="Ranked candidates"
          value={withApplicants.reduce((s, j) => s + j.screened, 0)}
          sub={`${withApplicants.reduce((s, j) => s + j.applicants.length, 0)} applicants`}
        />
      </div>

      <div className="section">
        {anyDemo && <DemoNotice>{DEMO_SCORE_NOTE}</DemoNotice>}
        {visible.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No roles with applicants yet."
              hint="Post a role and wait for candidates to apply, then run the shortlist."
            />
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Required skills</th>
                    <th>Applicants</th>
                    <th>Screened</th>
                    <th>Verified</th>
                    <th>Top score</th>
                    <th>Posted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <div>
                          {j.title} {isDemoId(j.id) && <DemoBadge label="demo" />}
                        </div>
                        <div className="muted small">
                          {j.company}
                          {j.location ? ` · ${j.location}` : ""}
                        </div>
                      </td>
                      <td>
                        <div className="row">
                          {j.requiredSkills.slice(0, 4).map((s) => (
                            <span className="tag" key={s}>
                              {s}
                            </span>
                          ))}
                          {j.requiredSkills.length > 4 && (
                            <span className="muted small">+{j.requiredSkills.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="mono">{j.applicants.length}</td>
                      <td>
                        {j.applicants.length === 0 ? (
                          <span className="muted small">no applicants</span>
                        ) : j.screened === 0 ? (
                          <span className="badge flagged">not screened</span>
                        ) : j.screened === j.applicants.length ? (
                          <span className="badge pass">{j.screened} of {j.applicants.length}</span>
                        ) : (
                          <span className="badge flagged">
                            {j.screened} of {j.applicants.length}
                          </span>
                        )}
                      </td>
                      <td className="mono">{j.verified}</td>
                      <td>
                        {j.bestRankScore === null ? (
                          <span className="muted small">—</span>
                        ) : (
                          <span className="mono">{j.bestRankScore.toFixed(3)}</span>
                        )}
                      </td>
                      <td className="muted small">{formatDate(j.createdAt)}</td>
                      <td>
                        <Link href={`/recruiter/jobs/${j.id}`}>
                          <button className="small">
                            {j.applicants.length === 0 ? "View" : j.screened === 0 ? "Run" : "Open"}
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

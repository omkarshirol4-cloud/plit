"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RoleGate } from "@/components/TopNav";
import { EmptyState, ErrorState, Loading, StatCard, StatusPill, VerificationPill, formatDate } from "@/components/ui";
import { rollupByJob, useRecruiterData } from "@/lib/recruiter-data";

type Filter = "all" | "unscreened" | "verified" | "unverified" | "review";

/**
 * /recruiter/applicants — every application across every role.
 *
 * The same rows the shortlists rank, flattened so a recruiter can triage by
 * screening or verification state without opening each job.
 */
export default function RecruiterApplicants() {
  return (
    <RoleGate need="recruiter">
      <RecruiterApplicantsInner />
    </RoleGate>
  );
}

function RecruiterApplicantsInner() {
  const { data, loading, error, reload } = useRecruiterData();
  const [filter, setFilter] = useState<Filter>("all");
  const [jobId, setJobId] = useState("");
  const [q, setQ] = useState("");

  const jobs = useMemo(() => rollupByJob(data), [data]);

  if (loading && !data) return <Loading label="Loading applicants" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading applicants" />;

  const needle = q.trim().toLowerCase();
  const apps = data.applications.filter((a) => {
    if (jobId && a.jobId !== jobId) return false;
    if (filter === "unscreened" && a.screeningRankScore !== null) return false;
    if (filter === "verified" && a.verificationResult !== "pass") return false;
    if (filter === "unverified" && a.verificationResult !== null) return false;
    if (filter === "review" && a.verificationResult !== "flagged" && a.verificationResult !== "fail") return false;
    if (needle && !a.candidateName.toLowerCase().includes(needle) && !a.jobTitle.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });

  const counts = {
    all: data.applications.length,
    unscreened: data.applications.filter((a) => a.screeningRankScore === null).length,
    verified: data.applications.filter((a) => a.verificationResult === "pass").length,
    unverified: data.applications.filter((a) => a.verificationResult === null).length,
    review: data.applications.filter((a) => a.verificationResult === "flagged" || a.verificationResult === "fail")
      .length,
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "unscreened", label: `Awaiting screening (${counts.unscreened})` },
    { key: "verified", label: `Verified (${counts.verified})` },
    { key: "unverified", label: `Unverified (${counts.unverified})` },
    { key: "review", label: `Needs review (${counts.review})` },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Applicants</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {apps.length} shown of {data.applications.length}
          </p>
        </div>
        <div className="page-actions">
          <input placeholder="Search name or role…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">All roles</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section">
        <div className="row">
          {filters.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "" : "secondary"}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section stat-grid">
        <StatCard label="Total applicants" value={counts.all} />
        <StatCard label="Screened" value={counts.all - counts.unscreened} tone="accent" />
        <StatCard label="Awaiting screening" value={counts.unscreened} tone={counts.unscreened ? "warn" : undefined} />
        <StatCard label="Verified" value={counts.verified} tone="ok" />
      </div>

      <div className="section">
        {apps.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No applicants match this view."
              hint={data.applications.length === 0 ? "Applicants appear here as candidates apply." : "Try a different filter."}
            />
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
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
                    <tr key={a.id}>
                      <td>
                        <div>{a.candidateName}</div>
                        <div className="muted small mono">{a.candidateId}</div>
                      </td>
                      <td className="muted small">{a.jobTitle}</td>
                      <td className="muted small">{formatDate(a.createdAt)}</td>
                      <td>
                        <StatusPill status={a.status} />
                      </td>
                      <td>
                        {a.screeningRankScore === null ? (
                          <span className="muted small">awaiting screening</span>
                        ) : (
                          <>
                            <span className="mono">{a.screeningRankScore.toFixed(3)}</span>
                            {a.screeningMultiplier !== null && (
                              <div className="muted small">×{a.screeningMultiplier.toFixed(2)}</div>
                            )}
                          </>
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
          </div>
        )}
      </div>
    </>
  );
}

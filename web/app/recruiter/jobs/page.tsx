"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/TopNav";
import { EmptyState, ErrorState, Loading, StatCard, formatDate } from "@/components/ui";
import { getJson } from "@/lib/session";
import type { JobRow } from "@/lib/candidate-data";

/** /recruiter/jobs — post a role, then trigger its shortlist. */
export default function RecruiterJobs() {
  return (
    <RoleGate need="recruiter">
      <RecruiterJobsInner />
    </RoleGate>
  );
}

function RecruiterJobsInner() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await getJson<{ jobs: JobRow[] }>("/api/jobs");
        if (!cancelled) {
          setJobs(d.jobs ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loading label="Loading jobs" />;
  if (error) return <ErrorState message={error} />;

  const needle = q.trim().toLowerCase();
  const visible = jobs.filter(
    (j) =>
      !needle ||
      j.title.toLowerCase().includes(needle) ||
      j.company.toLowerCase().includes(needle) ||
      j.requiredSkills.some((s) => s.toLowerCase().includes(needle)),
  );
  const open = jobs.filter((j) => j.status === "open");
  const totalApplicants = jobs.reduce((s, j) => s + j.applicantCount, 0);
  const unranked = jobs.filter((j) => j.applicantCount > 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {open.length} open of {jobs.length} · {totalApplicants} applicants across all roles
          </p>
        </div>
        <div className="page-actions">
          <input placeholder="Filter roles…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
          <Link href="/recruiter/jobs/new">
            <button>Post a job</button>
          </Link>
        </div>
      </div>

      <div className="section">
        {visible.length === 0 ? (
          <div className="panel">
            <EmptyState title={q ? `No roles match “${q}”.` : "No jobs yet."} hint={q ? undefined : "Post the first one."} />
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
                    <th>Posted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <div>{j.title}</div>
                        <div className="muted small">
                          {j.company}
                          {j.location ? ` · ${j.location}` : ""}
                        </div>
                        {j.status !== "open" && <span className="badge none">{j.status}</span>}
                      </td>
                      <td>
                        {j.requiredSkills.map((s) => (
                          <span className="tag" key={s}>
                            {s}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className="mono">{j.applicantCount}</span>
                        {j.applicantCount === 0 ? (
                          <div className="muted small">no applicants</div>
                        ) : (
                          <div className="muted small">
                            <Link href={`/recruiter/jobs/${j.id}`}>shortlist</Link>
                          </div>
                        )}
                      </td>
                      <td className="muted small">{formatDate(j.createdAt)}</td>
                      <td>
                        <Link href={`/recruiter/jobs/${j.id}`}>
                          <button className="small">Open</button>
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

      <div className="section stat-grid">
        <StatCard label="Open roles" value={open.length} tone="accent" />
        <StatCard label="Total applicants" value={totalApplicants} />
        <StatCard label="Roles with applicants" value={unranked} sub="run a shortlist on each" />
      </div>
    </>
  );
}

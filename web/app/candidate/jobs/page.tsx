"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { JobCard } from "@/components/candidate-cards";
import { NoCandidate, ErrorState, EmptyState } from "@/components/ui";
import { ChallengeGridSkeleton } from "@/components/Skeletons";
import { useCandidateBundle } from "@/lib/candidate-data";
import { useCandidateId } from "@/lib/client";

/**
 * /candidate/jobs — every role, with real applied state per card.
 *
 * `?job=<id>` scrolls to and highlights that card, so the deep links the
 * dashboard and applications pages emit actually land somewhere visible.
 */
export default function CandidateJobs() {
  return (
    <Suspense fallback={<ChallengeGridSkeleton />}>
      <JobsInner />
    </Suspense>
  );
}

function JobsInner() {
  const [candidateId, , ready] = useCandidateId();
  const { data, error, loading, reload } = useCandidateBundle(candidateId, ready);
  const params = useSearchParams();
  const focusId = params.get("job");
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const appByJobId = useMemo(
    () => new Map((data?.applications ?? []).map((a) => [a.jobId, a])),
    [data?.applications],
  );

  // Deep link `?job=<id>` (used by the dashboard and the legacy verify flow):
  // wait for the list to render, then bring the card into view.
  useEffect(() => {
    if (!focusId || !data) return;
    const el = document.getElementById(`job-${focusId}`);
    if (!el) return;
    const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    return () => window.clearTimeout(t);
  }, [focusId, data]);

  const visible = useMemo(() => {
    const jobs = data?.jobs ?? [];
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (onlyOpen && j.status !== "open") return false;
      if (!needle) return true;
      return (
        j.title.toLowerCase().includes(needle) ||
        j.company.toLowerCase().includes(needle) ||
        j.location.toLowerCase().includes(needle) ||
        j.requiredSkills.some((s) => s.toLowerCase().includes(needle))
      );
    });
  }, [data?.jobs, q, onlyOpen]);

  if (!ready) return <ChallengeGridSkeleton />;
  if (!candidateId) {
    return (
      <>
        <h1>Jobs</h1>
        <NoCandidate what="the job list" />
      </>
    );
  }
  if (loading) return <ChallengeGridSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const appliedCount = (data?.applications ?? []).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Open roles</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {visible.length} of {data?.jobs.length} shown · {appliedCount} applied
          </p>
        </div>
        <div className="page-actions">
          <input
            placeholder="Filter by title, company, skill…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <button className={onlyOpen ? "" : "secondary"} onClick={() => setOnlyOpen((v) => !v)}>
            {onlyOpen ? "Showing open only" : "Show open only"}
          </button>
        </div>
      </div>

      <div className="section">
        {visible.length === 0 ? (
          <div className="panel">
            <EmptyState
              title={q ? `No roles match “${q}”.` : "No roles to show."}
              hint={q ? "Try a shorter search term." : "Check back once a recruiter posts a role."}
            />
          </div>
        ) : (
          <div className="cards">
            {visible.map((job) => (
              <div key={job.id} id={`job-${job.id}`} style={focusId === job.id ? { scrollMarginTop: 80 } : undefined}>
                <div className={focusId === job.id ? "card-focus" : undefined}>
                  <JobCard job={job} application={appByJobId.get(job.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {focusId && !appByJobId.has(focusId) && (
        <p className="muted small">
          Looking for one specific role? <Link href={`/candidate/jobs/${focusId}`}>Open it directly</Link>.
        </p>
      )}
    </>
  );
}

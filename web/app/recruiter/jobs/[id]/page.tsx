"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { NotRankedList, RankedCandidateTable } from "@/components/RankedCandidateTable";
import { RoleGate } from "@/components/TopNav";
import { ErrorState, formatDateTime } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeletons";
import { getJson } from "@/lib/session";
import type { RankedCandidate } from "@/lib/types";

type ShortlistResponse = {
  job: { id: string; title: string; company: string; location: string; requiredSkills: string[] };
  applicantCount: number;
  rankedAt: string | null;
  ranked: RankedCandidate[];
  notYetRanked: { applicationId: string; name: string; hasResume: boolean }[];
};

/**
 * /recruiter/jobs/[id] — applicants and the ranked shortlist for one role.
 *
 * "Run shortlist" is the existing POST /api/shortlist; the button is disabled
 * with an explanatory label when there is nobody to rank.
 */
export default function JobShortlist({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGate need="recruiter">
      <JobShortlistInner params={params} />
    </RoleGate>
  );
}

function JobShortlistInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = use(params);
  const [data, setData] = useState<ShortlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await getJson<ShortlistResponse>(`/api/jobs/${id}/shortlist`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(jobId);
  }, [jobId, load]);

  async function trigger() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `shortlist failed (${res.status})`);
      setMsg({
        kind: "ok",
        text:
          `Ranked ${d.rankedCount} candidate${d.rankedCount === 1 ? "" : "s"}.` +
          (d.skippedNoResume?.length ? ` Skipped (no resume): ${d.skippedNoResume.join(", ")}.` : ""),
      });
      await load(jobId);
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <TableSkeleton rows={6} cols={6} />;
  if (error && !data) return <ErrorState message={error} onRetry={() => load(jobId)} />;
  if (!data) return <TableSkeleton rows={6} cols={6} />;

  const noApplicants = data.applicantCount === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{data.job.title}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {data.job.company}
            {data.job.location ? ` · ${data.job.location}` : ""} · {data.applicantCount} applicant
            {data.applicantCount === 1 ? "" : "s"} ·{" "}
            {data.rankedAt ? `ranked ${formatDateTime(data.rankedAt)}` : "not ranked yet"}
          </p>
        </div>
        <div className="page-actions">
          <button onClick={trigger} disabled={busy || noApplicants} title={noApplicants ? "No applicants yet" : undefined}>
            {busy ? "Ranking…" : data.ranked.length ? "Re-run shortlist" : "Run shortlist"}
          </button>
          <Link href="/recruiter/jobs">
            <button className="secondary">All jobs</button>
          </Link>
        </div>
      </div>

      {noApplicants && (
        <div className="msg info">Nobody has applied to this role yet, so there is nothing to rank.</div>
      )}

      <div className="section panel">
        <h3 style={{ marginTop: 0 }}>Required skills</h3>
        <div className="row">
          {data.job.requiredSkills.length === 0 ? (
            <span className="muted small">None listed.</span>
          ) : (
            data.job.requiredSkills.map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))
          )}
        </div>
        <p className="muted small" style={{ margin: "12px 0 0" }}>
          Screening ranks resumes against these skills. Verification multiplies the result; tokens never do.
        </p>
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="section">
        <h2 style={{ marginTop: 0 }}>Shortlist</h2>
        <RankedCandidateTable ranked={data.ranked} />
      </div>

      <div className="section">
        <NotRankedList rows={data.notYetRanked} />
      </div>
    </>
  );
}

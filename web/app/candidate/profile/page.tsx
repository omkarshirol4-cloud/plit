"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CandidateProfileForm } from "@/components/candidate-identity";
import { EmptyState, ErrorState, StatCard, formatDate } from "@/components/ui";
import { ProfileSkeleton } from "@/components/Skeletons";
import { useCandidateBundle } from "@/lib/candidate-data";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { Candidate, TokenTransaction } from "@/lib/types";

/**
 * /candidate/profile — details, resume, and a read-only activity summary.
 *
 * The editable parts come from the shared CandidateProfileForm used by the
 * signed-out dashboard, so the field list cannot drift between the two.
 */
export default function ProfilePage() {
  const [candidateId, , ready] = useCandidateId();
  const { data, error, loading, reload } = useCandidateBundle(candidateId, ready);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [history, setHistory] = useState<TokenTransaction[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, h] = await Promise.all([
          getJson<{ candidate: Candidate }>(`/api/candidates/${candidateId}`),
          getJson<{ transactions: TokenTransaction[] }>(`/api/candidates/${candidateId}/tokens/history?limit=5`),
        ]);
        if (cancelled) return;
        setCandidate(c.candidate);
        setHistory(h.transactions ?? []);
        setDetailError(null);
      } catch (e) {
        if (!cancelled) setDetailError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  if (!ready || loading) return <ProfileSkeleton />;
  if (!candidateId)
    return (
      <>
        <h1>Profile</h1>
        <CandidateProfileForm candidate={null} />
      </>
    );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (detailError) return <ErrorState message={detailError} onRetry={reload} />;
  if (!data) return <ProfileSkeleton />;

  const { profile, assessments, wallet } = data.dashboard;
  const completedAssessments = assessments.filter((a) => a.completed);
  const best = completedAssessments.reduce((m, a) => Math.max(m, a.score ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {candidate?.email} · joined {formatDate(candidate?.createdAt)}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate">
            <button className="secondary small">Dashboard</button>
          </Link>
        </div>
      </div>

      <div className="section stat-grid">
        <StatCard
          label="Profile completion"
          value={`${profile.percent}%`}
          sub={`${profile.completed} of ${profile.total} checks`}
          tone={profile.percent === 100 ? "ok" : "warn"}
        />
        <StatCard label="Skills on file" value={candidate?.skills.length ?? 0} />
        <StatCard
          label="Resume"
          value={candidate?.resumeName ? "on file" : "missing"}
          sub={candidate?.resumeName ?? "upload one to be ranked"}
          tone={candidate?.resumeName ? "ok" : "err"}
        />
        <StatCard label="Token balance" value={wallet.balance} tone="accent" />
      </div>

      <div className="section">
        <h2 style={{ marginTop: 0 }}>Edit</h2>
        <CandidateProfileForm candidate={candidate} />
      </div>

      <div className="section grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Assessment summary</h2>
          {completedAssessments.length === 0 ? (
            <EmptyState
              title="No assessments completed."
              hint="Assessments are optional but they add signal to your profile."
            />
          ) : (
            <>
              <p className="muted small">
                {completedAssessments.length} of {assessments.length} completed
                {best > 0 ? ` · best score ${best}%` : ""}
              </p>
              <div style={{ padding: 0 }}>
                {assessments.map((a) => (
                  <div className="list-row" key={a.id}>
                    <div className="list-row-main">
                      <div className="list-row-title">{a.title}</div>
                      <div className="list-row-sub">{a.questionCount} questions</div>
                    </div>
                    {a.completed ? (
                      <Link className="small" href={`/candidate/assessments/${a.id}/result`}>
                        {a.score}%
                      </Link>
                    ) : (
                      <span className="muted small">not taken</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Recent token activity</h2>
          {history.length === 0 ? (
            <EmptyState title="No activity yet." hint="Complete your profile to start earning." />
          ) : (
            <div style={{ padding: 0 }}>
              {history.map((t) => (
                <div className="list-row" key={t.id}>
                  <div className="list-row-main">
                    <div className="list-row-title" style={{ fontWeight: 400 }}>
                      {t.description || t.type}
                    </div>
                    <div className="list-row-sub">{formatDate(t.createdAt)}</div>
                  </div>
                  <span className={t.amount >= 0 ? "amount-pos mono" : "amount-neg mono"}>
                    {t.amount >= 0 ? `+${t.amount}` : t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted small" style={{ margin: "12px 0 0" }}>
            <Link href="/candidate/rewards/history">Full transaction history</Link>
          </p>
        </div>
      </div>
    </>
  );
}

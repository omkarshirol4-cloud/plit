"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AchievementToast, takeUnlocked } from "@/components/AchievementToast";
import { TokenBalanceCard } from "@/components/TokenBalanceCard";
import { ErrorState, Loading, StatCard, formatDateTime } from "@/components/ui";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { Assessment, AssessmentAttempt, CandidateWallet, UnlockedAchievement } from "@/lib/types";

/**
 * /candidate/assessments/[id]/result
 *
 * Reads the persisted attempt rather than anything held in the browser, so a
 * refresh or a shared link shows the same result. The score is the one the
 * server computed and stored at submit time; the token balance is the ledger's,
 * not a locally added number.
 */
export default function AssessmentResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assessmentId } = use(params);
  const [candidateId, , ready] = useCandidateId();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [wallet, setWallet] = useState<CandidateWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    if (!candidateId) return;
    // Read once, then cleared, so a refresh does not replay the banner.
    setUnlocked(takeUnlocked(candidateId));
  }, [candidateId]);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [a, r, w] = await Promise.all([
          getJson<{ assessment: Assessment }>(`/api/assessments/${assessmentId}`),
          getJson<{ attempt: AssessmentAttempt }>(
            `/api/assessments/${assessmentId}/result?candidateId=${encodeURIComponent(candidateId)}`,
          ),
          getJson<{ wallet: CandidateWallet }>(`/api/candidates/${candidateId}/tokens`),
        ]);
        if (cancelled) return;
        setAssessment(a.assessment);
        setAttempt(r.attempt);
        setWallet(w.wallet);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId, assessmentId]);

  if (!ready || loading) return <Loading label="Loading result" />;

  if (!candidateId) {
    return (
      <>
        <h1>Assessment result</h1>
        <div className="msg info">
          Pick a candidate on the <Link href="/candidate">candidate dashboard</Link> first.
        </div>
      </>
    );
  }

  if (!attempt) {
    return (
      <>
        <h1>Assessment result</h1>
        {error && <div className="msg error">{error}</div>}
        <p className="muted">You have not taken this assessment yet.</p>
        <Link href="/candidate/assessments">
          <button>Back to assessments</button>
        </Link>
      </>
    );
  }

  if (!attempt.completed) {
    return (
      <>
        <h1>{assessment?.title ?? "Assessment"}</h1>
        <div className="msg info">This attempt is still in progress and has not been submitted.</div>
        <Link href={`/candidate/assessments/${assessmentId}`}>
          <button>Resume assessment</button>
        </Link>
      </>
    );
  }

  if (error) return <ErrorState message={error} />;

  const score = attempt.score ?? 0;
  const total = attempt.totalCount ?? assessment?.questionCount ?? 0;
  const correct = attempt.correctCount ?? 0;
  const passed = score >= 60;

  return (
    <>
      <AchievementToast unlocked={unlocked} onDismiss={() => setUnlocked([])} />

      <div className="trophy-hero">
        <div className="big" aria-hidden="true">
          {passed ? "🎉" : "📘"}
        </div>
        <h1 style={{ marginBottom: 4 }}>{assessment?.title ?? "Assessment"} result</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          Graded on the server &middot; completed {formatDateTime(attempt.completedAt)}
        </p>
      </div>

      <div className="stat-grid">
        <StatCard label="Score" value={`${score}%`} sub={`${correct} of ${total} correct`} tone={passed ? "ok" : "warn"} />
        <StatCard label="Outcome" value={passed ? "Passed" : "Not passed"} sub="60% to pass" />
        <StatCard
          label="Tokens earned"
          value={attempt.score !== null ? `+${assessment?.tokenReward ?? 0}` : 0}
          sub="paid once by the server"
          tone="accent"
        />
        <StatCard
          label="Token balance"
          value={wallet ? wallet.balance : "—"}
          sub={wallet ? `${wallet.lifetimeEarned} lifetime` : undefined}
        />
      </div>

      <div className="section panel">
        <div className="progress-row">
          <span>Your score</span>
          <span>{score}%</span>
        </div>
        <div className="meter">
          <div style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        </div>
        <p className="muted small" style={{ margin: "12px 0 0" }}>
          The answer key never reaches the browser, so this score is the stored result of the server-side grading. The
          token reward is paid once and cannot be re-claimed by resubmitting.
        </p>
      </div>

      {unlocked.length > 0 && (
        <div className="section panel">
          <h2 style={{ marginTop: 0 }}>New achievements</h2>
          <div className="ach-list">
            {unlocked.map((a) => (
              <span className="ach-pill on" key={a.code}>
                {a.title} <span className="ach-reward">+{a.tokenReward}</span>
              </span>
            ))}
          </div>
          <p className="muted small" style={{ margin: "12px 0 0" }}>
            <Link href="/candidate/achievements">See all achievements</Link>
          </p>
        </div>
      )}

      <div className="section">
        <TokenBalanceCard wallet={wallet} />
      </div>

      <div className="row">
        <Link href="/candidate/assessments">
          <button className="secondary">Back to assessments</button>
        </Link>
        <Link href="/candidate/rewards">
          <button className="secondary">View rewards</button>
        </Link>
      </div>
    </>
  );
}

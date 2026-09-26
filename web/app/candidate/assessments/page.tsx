"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, NoCandidate } from "@/components/ui";
import { ChallengeGridSkeleton } from "@/components/Skeletons";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { Assessment, AssessmentAttempt } from "@/lib/types";

/**
 * /candidate/assessments — the catalogue plus this candidate's attempt state.
 *
 * Each card shows the assessment's own domain, question count and token reward,
 * all read from the assessment row. A Start button is only ever disabled
 * because a candidate has not been picked, and the page says so.
 */
export default function AssessmentsPage() {
  const [candidateId, , ready] = useCandidateId();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getJson<{ assessments: Assessment[] }>("/api/assessments");
        if (cancelled) return;
        setAssessments(list.assessments ?? []);

        if (candidateId) {
          const mine = await getJson<{ attempts: AssessmentAttempt[] }>(
            `/api/candidates/${candidateId}/assessments`,
          );
          if (!cancelled) setAttempts(mine.attempts ?? []);
        } else {
          setAttempts([]);
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
  }, [candidateId]);

  if (!ready || loading) return <ChallengeGridSkeleton />;
  if (error) return <ErrorState message={error} />;

  const attemptFor = (assessmentId: string) => attempts.find((a) => a.assessmentId === assessmentId);
  const done = attempts.filter((a) => a.completed).length;
  const earned = assessments
    .filter((a) => attemptFor(a.id)?.completed)
    .reduce((sum, a) => sum + a.tokenReward, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assessments</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {done} of {assessments.length} completed
            {done > 0 ? ` · ${earned} tokens earned from assessments` : ""}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/rewards">
            <button className="secondary small">Rewards</button>
          </Link>
        </div>
      </div>

      <div className="section">
        {!candidateId && <NoCandidate what="assessments" />}

        {assessments.length === 0 ? (
          <div className="panel">
            <EmptyState title="No assessments are available right now." />
          </div>
        ) : (
          <div className="cards">
            {assessments.map((a) => {
              const attempt = attemptFor(a.id);
              return (
                <div className="panel job-card" key={a.id}>
                  <div className="job-card-top">
                    <div>
                      <h3>{a.title}</h3>
                      <div className="job-card-meta">
                        {a.domain} &middot; {a.questionCount} questions
                      </div>
                    </div>
                    <span className="badge ok">+{a.tokenReward} tokens</span>
                  </div>

                  <p className="job-card-desc">{a.description}</p>

                  <div className="job-card-foot">
                    {attempt?.completed ? (
                      <span className="row">
                        <span className="badge pass">Completed &middot; {attempt.score}%</span>
                        <Link href={`/candidate/assessments/${a.id}/result`}>
                          <button className="secondary small">View result</button>
                        </Link>
                      </span>
                    ) : attempt ? (
                      <span className="row">
                        <span className="badge flagged">In progress</span>
                        <Link href={`/candidate/assessments/${a.id}`}>
                          <button className="small">Resume</button>
                        </Link>
                      </span>
                    ) : candidateId ? (
                      <Link href={`/candidate/assessments/${a.id}`}>
                        <button className="small">Start assessment</button>
                      </Link>
                    ) : (
                      <span className="muted small">Pick a candidate to start</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

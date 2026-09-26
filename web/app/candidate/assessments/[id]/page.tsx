"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { stashUnlocked } from "@/components/AchievementToast";
import { ErrorState, Loading } from "@/components/ui";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { Assessment, AssessmentAttempt, UnlockedAchievement } from "@/lib/types";

/**
 * /candidate/assessments/[id] — intro, then a one-question-at-a-time runner.
 *
 * Only the chosen option indexes are ever sent. The score, the token reward and
 * the achievement unlocks are all decided server-side; this page cannot
 * influence any of them.
 */
export default function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assessmentId } = use(params);
  const router = useRouter();
  const [candidateId, , ready] = useCandidateId();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getJson<{ assessment: Assessment }>(`/api/assessments/${assessmentId}`)
      .then((d) => {
        if (!cancelled) setAssessment(d.assessment);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  async function start() {
    if (!candidateId) return;
    setBusy(true);
    setError(null);
    try {
      const d = await fetch(`/api/assessments/${assessmentId}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      }).then((r) => r.json().then((j) => ({ ok: r.ok, j })));

      if (!d.ok) throw new Error(d.j.error ?? "could not start");
      const a = d.j.attempt as AssessmentAttempt;
      setAttempt(a);

      // One attempt per assessment. If it is already graded, go straight to the
      // result rather than pretending there is something left to answer.
      if (a.completed) {
        router.replace(`/candidate/assessments/${assessmentId}/result`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!candidateId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, answers: selected }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "submission failed");
      // Carry just-unlocked achievements across the client-side navigation.
      stashUnlocked(candidateId, (d.achievementsUnlocked ?? []) as UnlockedAchievement[]);
      router.push(`/candidate/assessments/${assessmentId}/result`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Loading label="Loading assessment" />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!assessment) return <Loading label="Loading assessment" />;

  const questions = assessment.questions;
  const total = questions.length;
  const answered = Object.keys(selected).length;
  const onLastPage = page === total - 1;
  const current = questions[page];

  if (!candidateId) {
    return (
      <>
        <h1>{assessment.title}</h1>
        <div className="panel">
          <div className="msg info">
            Pick a candidate on the <Link href="/candidate">candidate dashboard</Link> before starting.
          </div>
          <Link href="/candidate">
            <button>Go to dashboard</button>
          </Link>
        </div>
      </>
    );
  }

  // Preflight ---------------------------------------------------------------
  if (!attempt) {
    return (
      <>
        <h1>{assessment.title}</h1>
        <p className="sub">
          {assessment.description} &middot; {total} questions &middot; earns{" "}
          <strong>{assessment.tokenReward} tokens</strong> on completion.
        </p>
        {error && <div className="msg error">{error}</div>}

        <div className="panel">
          <h3>Before you start</h3>
          <ul className="muted small" style={{ paddingLeft: 18, marginTop: 0 }}>
            <li>You get one attempt. Once submitted, it cannot be retaken.</li>
            <li>Questions are shown one at a time; you can go back and change an answer.</li>
            <li>Your score is calculated on the server from the stored answer key.</li>
            <li>The token reward is paid once, by the server, on a valid submission.</li>
          </ul>
          <div className="row">
            <button onClick={start} disabled={busy}>
              {busy ? "Starting…" : "Start assessment"}
            </button>
            <Link href="/candidate/assessments">
              <button className="secondary">Back</button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Runner ------------------------------------------------------------------
  return (
    <>
      <div className="runner-bar">
        <div>
          <strong>{assessment.title}</strong>
          <div className="muted small">
            Question {page + 1} of {total} &middot; {answered} answered
          </div>
        </div>
        <div className="runner-progress">
          <div className="meter">
            <div style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="runner-dots">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setPage(i)}
              aria-label={`Go to question ${i + 1}`}
              aria-current={i === page}
              className={
                "runner-dot" + (selected[q.id] !== undefined ? " answered" : "") + (i === page ? " current" : "")
              }
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="msg error">{error}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>
          {page + 1}. {current.prompt}
        </h3>
        <div className="options">
          {current.options.map((opt, oi) => (
            <label key={oi} className={"option" + (selected[current.id] === oi ? " option-sel" : "")}>
              <input
                type="radio"
                name={current.id}
                checked={selected[current.id] === oi}
                onChange={() => setSelected((s) => ({ ...s, [current.id]: oi }))}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="row between">
        <button className="secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || busy}>
          Previous
        </button>

        {onLastPage ? (
          <button onClick={submit} disabled={busy || answered === 0}>
            {busy ? "Submitting…" : `Submit ${answered}/${total} answers`}
          </button>
        ) : (
          <button onClick={() => setPage((p) => Math.min(total - 1, p + 1))} disabled={busy}>
            Next
          </button>
        )}
      </div>

      {onLastPage && answered < total && (
        <p className="muted small" style={{ marginTop: 10 }}>
          {total - answered} {total - answered === 1 ? "question is" : "questions are"} still unanswered. You can
          submit anyway or use the numbered buttons to go back.
        </p>
      )}
    </>
  );
}

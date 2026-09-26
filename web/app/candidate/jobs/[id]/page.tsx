"use client";

import Link from "next/link";
import { use, useState } from "react";
import { EmptyState, ErrorState, Loading, StatusPill, VerificationPill, formatDate } from "@/components/ui";
import { useCandidateBundle } from "@/lib/candidate-data";
import { postJson, useCandidateId } from "@/lib/client";
import { recommendedScoreLabel } from "@/lib/score-label";
import type { JobRow } from "@/lib/candidate-data";

/**
 * /candidate/jobs/[id] — the detail + apply screen.
 *
 * The apply call is the existing POST /api/applications. Whatever the server
 * returns is what is shown: a real 409 (already applied), a real 409 (job
 * closed) or a real warning about a missing resume. No optimistic "applied".
 */
export default function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidateId, , ready] = useCandidateId();
  const { data, loading, error, reload } = useCandidateBundle(candidateId, ready);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  if (!ready) return <Loading label="Loading job" />;
  if (loading) return <Loading label="Loading job" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading job" />;

  const job: JobRow | undefined = data.jobs.find((j) => j.id === id);
  if (!job) {
    return (
      <div className="panel">
        <h1>Job not found</h1>
        <EmptyState title="This role is not in the open jobs list." hint="It may have been closed or removed." />
        <Link href="/candidate/jobs">
          <button>Back to jobs</button>
        </Link>
      </div>
    );
  }

  const application = data.applications.find((a) => a.jobId === job.id);
  const closed = job.status !== "open";
  const label = recommendedScoreLabel(application ? application.screeningRankScore : null);

  async function apply() {
    if (!candidateId) return;
    setBusy(true);
    setMsg(null);
    try {
      const d = await postJson<{ application: { id: string }; warning?: string }>("/api/applications", {
        candidateId,
        jobId: job!.id,
        note,
      });
      setMsg({
        kind: d.warning ? "info" : "ok",
        text: d.warning
          ? `Application submitted. Heads up: ${d.warning}.`
          : "Application submitted. The recruiter's screening will pick it up shortly.",
      });
      setNote("");
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {job.company}
            {job.location ? ` · ${job.location}` : ""} · posted {formatDate(job.createdAt)}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/jobs">
            <button className="secondary small">All jobs</button>
          </Link>
        </div>
      </div>

      <div className="section grid-2">
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ marginTop: 0 }}>About this role</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{job.description || "No description provided."}</p>

          <h3>Required skills</h3>
          {job.requiredSkills.length === 0 ? (
            <p className="muted small">None listed.</p>
          ) : (
            <div className="row">
              {job.requiredSkills.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="muted small" style={{ marginTop: 14 }}>
            {job.applicantCount} {job.applicantCount === 1 ? "applicant" : "applicants"} so far. Screening ranks on your
            resume against the required skills above.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ marginBottom: 0 }}>
            <h2 style={{ marginTop: 0 }}>Your screening</h2>
            {application ? (
              <>
                <p style={{ margin: "0 0 8px" }}>
                  {label.kind === "pending" ? (
                    <span className="muted">Apply to get AI screening score</span>
                  ) : (
                    <>
                      <span className="muted small">AI Match Score </span>
                      <span className="mono" style={{ fontSize: 18 }}>{label.text}</span>
                    </>
                  )}
                </p>
                <p className="row" style={{ marginBottom: 0 }}>
                  <StatusPill status={application.status} />
                  <VerificationPill result={application.verificationResult} />
                </p>
                <p className="muted small" style={{ margin: "10px 0 0" }}>
                  Applied {formatDate(application.createdAt)} ·{" "}
                  <Link href="/candidate/applications">all applications</Link>
                </p>
                {!application.verificationResult && (
                  <div style={{ marginTop: 12 }}>
                    <Link href="/candidate/verification">
                      <button className="secondary small">Record verification clip</button>
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="muted small" style={{ margin: "0 0 6px" }}>Apply to get AI screening score</p>
                {closed ? (
                  <div className="msg error">This role is no longer accepting applications.</div>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="note">Note to the recruiter (optional)</label>
                      <textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Anything relevant about this role…"
                      />
                    </div>
                    <button onClick={apply} disabled={busy || !candidateId}>
                      {busy ? "Submitting…" : "Apply now"}
                    </button>
                    {msg && <div className={`msg ${msg.kind}`} style={{ marginTop: 12, marginBottom: 0 }}>{msg.text}</div>}
                  </>
                )}
              </>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 0 }}>
            <h3 style={{ marginTop: 0 }}>How ranking works here</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Your resume is parsed and compared against the required skills by the screening service. Verification
              multiplies that score when it passes. Tokens are engagement rewards only and never affect your rank.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

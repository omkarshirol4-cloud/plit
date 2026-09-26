"use client";

import Link from "next/link";
import { StatusPill, VerificationPill, formatDate } from "@/components/ui";
import { applicationScoreLabel, recommendedScoreLabel, type ScoreLabel } from "@/lib/score-label";
import type { ApplicationRow, JobRow } from "@/lib/candidate-data";

/** Cards and rows shared by the dashboard, the jobs list and applications. */

function ScoreText({ label }: { label: ScoreLabel }) {
  if (label.kind === "pending") return <span className="muted small">{label.text}</span>;
  return (
    <>
      <span className="mono">{label.text}</span>
      {label.multiplier !== null && <span className="muted small"> &times;{label.multiplier.toFixed(2)}</span>}
    </>
  );
}

/** Score for one application: pending text, or the real score + multiplier. */
export function ApplicationScore({ a }: { a: ApplicationRow }) {
  return <ScoreText label={applicationScoreLabel(a.screeningRankScore, a.screeningMultiplier)} />;
}

/** Score for a job card. Unapplied jobs never show a number. */
export function JobScore({ job, application }: { job: JobRow; application?: ApplicationRow }) {
  const rankScore = application ? application.screeningRankScore : null;
  return <ScoreText label={recommendedScoreLabel(rankScore)} />;
}

export function JobCard({ job, application }: { job: JobRow; application?: ApplicationRow }) {
  const applied = Boolean(application);
  const closed = job.status !== "open";

  return (
    <div className="panel job-card">
      <div className="job-card-top">
        <div>
          <h3>{job.title}</h3>
          <div className="job-card-meta">
            {job.company}
            {job.location ? ` · ${job.location}` : ""} · posted {formatDate(job.createdAt)}
          </div>
        </div>
        {closed ? <span className="badge none">closed</span> : null}
      </div>

      {job.requiredSkills.length > 0 && (
        <div>
          {job.requiredSkills.map((s) => (
            <span className="tag" key={s}>
              {s}
            </span>
          ))}
        </div>
      )}

      {job.description && <p className="job-card-desc">{job.description}</p>}

      <div className="job-card-foot">
        <span className="job-scoreline">
          <JobScore job={job} application={application} />
        </span>
        <span className="row">
          <Link href={`/candidate/jobs/${job.id}`}>
            <button className="secondary small">View Job</button>
          </Link>
          {applied ? (
            <Link href="/candidate/applications">
              <button className="small" disabled>
                Applied
              </button>
            </Link>
          ) : (
            <Link href={`/candidate/jobs/${job.id}`}>
              <button className="small">Apply</button>
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}

export function ApplicationRowView({ a }: { a: ApplicationRow }) {
  return (
    <tr>
      <td>
        <div>{a.jobTitle}</div>
        <div className="muted small">{a.jobCompany}</div>
      </td>
      <td className="muted small">{formatDate(a.createdAt)}</td>
      <td>
        <StatusPill status={a.status} />
      </td>
      <td>
        <ApplicationScore a={a} />
      </td>
      <td>
        <VerificationPill result={a.verificationResult} />
      </td>
      <td>
        {a.verificationResult ? (
          <Link className="small" href={`/candidate/applications/${a.id}`}>
            view
          </Link>
        ) : (
          <Link className="small" href={`/candidate/verification?app=${a.id}`}>
            record clip
          </Link>
        )}
      </td>
    </tr>
  );
}

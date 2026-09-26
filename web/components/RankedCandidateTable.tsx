"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { DemoBadge, DemoNotice, VerificationPill, formatDate } from "@/components/ui";
import { DEMO_SCORE_NOTE, DEMO_VERIFICATION_NOTE, isDemoEmail } from "@/lib/demo-marker";
import type { RankedCandidate } from "@/lib/types";

/**
 * Ranked shortlist table.
 *
 * Shared by the per-job shortlist page and the all-jobs shortlists view so the
 * ranking breakdown is presented identically. Every number is the value the
 * screening service stored; nothing is recomputed or sorted client-side beyond
 * using the rank the server assigned.
 */
export function RankedCandidateTable({
  ranked,
  emptyHint,
}: {
  ranked: RankedCandidate[];
  emptyHint?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Seeded rows carry the `demo_seed_2026` namespace in the database but the
  // client only has the read-model shape, so demo membership is judged by the
  // reserved email domain. That domain is not routable, so it cannot collide
  // with a real record.
  const anyDemo = ranked.some((c) => isDemoEmail(c.email));

  if (ranked.length === 0) {
    return (
      <div className="panel">
        <p className="muted" style={{ margin: 0 }}>
          {emptyHint ?? "No ranking yet. Run the shortlist to score this applicant pool."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      {anyDemo && <DemoNotice>{DEMO_SCORE_NOTE}</DemoNotice>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Candidate</th>
              <th>Resume score</th>
              <th>Skills match</th>
              <th>Verification</th>
              <th>Rank score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ranked.map((c) => (
              // Key on the fragment, not the inner rows: the detail row is a
              // sibling of the main row, not a child of it.
              <Fragment key={c.applicationId}>
                <tr>
                  <td className="mono">{c.rank}</td>
                  <td>
                    <div>
                      {c.name} {isDemoEmail(c.email) && <DemoBadge />}
                    </div>
                    <div className="muted small mono">{c.email}</div>
                    {c.headline && <div className="muted small">{c.headline}</div>}
                    {!c.hasResume && <span className="badge flagged">no resume</span>}
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <span className="mono">{c.resumeScore.toFixed(3)}</span>
                    <div className="meter">
                      <div style={{ width: `${Math.min(1, Math.max(0, c.resumeScore)) * 100}%` }} />
                    </div>
                    <div className="muted small">tfidf {c.tfidfScore.toFixed(2)}</div>
                  </td>
                  <td style={{ minWidth: 190 }}>
                    {c.matchedSkills.map((s) => (
                      <span className="tag hit" key={`m-${s}`}>
                        {s}
                      </span>
                    ))}
                    {c.missingSkills.map((s) => (
                      <span className="tag" key={`x-${s}`}>
                        {s}
                      </span>
                    ))}
                  </td>
                  <td>
                    <VerificationPill result={c.verification.result} />
                    {c.verification.reviewedByHR && <div className="muted small">needs review</div>}
                  </td>
                  <td>
                    <span className="mono">{c.rankScore.toFixed(3)}</span>
                    {c.verificationMultiplier !== 1 && (
                      <div className="muted small">&times;{c.verificationMultiplier} verified</div>
                    )}
                  </td>
                  <td>
                    <div className="row">
                      <Link href={`/recruiter/candidates/${c.applicationId}`}>
                        <button className="secondary small">open</button>
                      </Link>
                      <button
                        className="secondary small"
                        aria-expanded={expanded === c.applicationId}
                        onClick={() => setExpanded(expanded === c.applicationId ? null : c.applicationId)}
                      >
                        {expanded === c.applicationId ? "hide" : "detail"}
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === c.applicationId && (
                  <tr>
                    <td colSpan={7} style={{ background: "var(--panel-2)" }}>
                      <ScoreBreakdown c={c} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The full scoring breakdown for one candidate: screening plus verification. */
export function ScoreBreakdown({ c }: { c: RankedCandidate }) {
  const v = c.verification;
  const demo = isDemoEmail(c.email);
  const rows: [string, string][] = [
    ["Skills score", c.skillsScore.toFixed(3)],
    [demo ? "Similarity score (demo estimate)" : "TF-IDF score", c.tfidfScore.toFixed(3)],
    ["Resume score", c.resumeScore.toFixed(3)],
    ["Verification multiplier", `×${c.verificationMultiplier}`],
    ["Final rank score", c.rankScore.toFixed(3)],
    ["Resume on file", c.resumeName ?? "—"],
    ["Applied", v.createdAt ? formatDate(v.createdAt) : "—"],
  ];

  return (
    <div className="grid-2">
      <div>
        <h3>Resume screening</h3>
        <div className="table-scroll">
          <table>
            <tbody>
              {rows.map(([k, val]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="mono">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {demo ? DEMO_SCORE_NOTE : "rank score = resume score × verification multiplier (pass 1.2×, unverified 1.0×, flagged 0.5×). Tokens are not an input."}
        </p>
      </div>

      <div>
        <h3>{demo ? "Verification (demo fixture)" : "Live verification breakdown"}</h3>
        {!v.result ? (
          <p className="muted small" style={{ margin: 0 }}>
            Not verified yet. The candidate records a webcam clip from their verification page; this fills in
            automatically.
          </p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <tbody>
                  <SignalRow label="Gaze" value={v.gazeScore} />
                  <SignalRow label="Lip-sync" value={v.lipSyncScore} />
                  <SignalRow label="Audio" value={v.audioScore} />
                  <SignalRow label="Fused" value={v.fusedScore} />
                </tbody>
              </table>
            </div>
            {v.reasons.length > 0 && (
              <ul className="small muted" style={{ paddingLeft: 18 }}>
                {v.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <p className="muted small" style={{ marginBottom: 0 }}>
              {demo
                ? DEMO_VERIFICATION_NOTE
                : v.reviewedByHR
                  ? "Routed to human review — a model output is never a final verdict."
                  : "Clean pass, no human review needed."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: number | null }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={{ width: 180 }}>
        {value === null ? (
          <span className="muted small">n/a</span>
        ) : (
          <>
            <span className="mono">{value.toFixed(3)}</span>
            <div className="meter">
              <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
            </div>
          </>
        )}
      </td>
    </tr>
  );
}

/** Applicants present on a job but absent from its ranking. */
export function NotRankedList({
  rows,
}: {
  rows: { applicationId: string; name: string; hasResume: boolean }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Applied but not in the ranking</h3>
      <ul className="small muted" style={{ margin: "0 0 8px", paddingLeft: 18 }}>
        {rows.map((a) => (
          <li key={a.applicationId}>
            <Link href={`/recruiter/candidates/${a.applicationId}`}>{a.name}</Link>{" "}
            {!a.hasResume && <span className="badge flagged">no resume uploaded</span>}
          </li>
        ))}
      </ul>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Re-run the shortlist to include them.
      </p>
    </div>
  );
}

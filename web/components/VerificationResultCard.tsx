"use client";

import Link from "next/link";
import { VerificationPill, formatDateTime } from "@/components/ui";
import type { VerificationSession } from "@/lib/types";

/**
 * The stored verification result for one application.
 *
 * One component, three call sites (verification hub, application detail, the
 * recruiter's candidate view) so the signal breakdown, the reasons and the
 * reviewer flag can never be presented two different ways.
 *
 * Every value comes from the stored session. Nothing here is recomputed.
 */
export function VerificationResultCard({
  session,
  actions,
}: {
  session: VerificationSession;
  actions?: React.ReactNode;
}) {
  const signals: [string, number | null, string][] = [
    ["Gaze", session.gazeScore, "fraction of frames looking on-screen"],
    ["Lip-sync", session.lipSyncScore, "mouth movement vs detected speech"],
    ["Audio", session.audioScore, "second-voice / overlapping speech"],
    ["Fused", session.fusedScore, "0.25 gaze + 0.40 lip-sync + 0.35 audio"],
  ];

  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <VerificationPill result={session.result} />
        {session.reviewedByHR && <span className="badge flagged">routed to human review</span>}
        <span className="muted small">scored {formatDateTime(session.createdAt)}</span>
      </div>

      {signals.map(([label, value, hint]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div className="progress-row">
            <span>
              {label} <span className="muted small">— {hint}</span>
            </span>
            <span className="mono">{value === null ? "n/a" : value.toFixed(3)}</span>
          </div>
          <div className="meter">
            <div
              style={{
                width: value === null ? "0%" : `${Math.max(0, Math.min(1, value)) * 100}%`,
                background: value === null ? "var(--muted)" : undefined,
              }}
            />
          </div>
        </div>
      ))}

      {session.reasons.length > 0 && (
        <>
          <h3>Reasons</h3>
          <ul className="small muted" style={{ paddingLeft: 18, marginTop: 0 }}>
            {session.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {actions ? <div className="row" style={{ marginTop: 12 }}>{actions}</div> : null}
    </div>
  );
}

/** Shown wherever an application exists but has not been verified yet. */
export function NotVerifiedYet({ applicationId }: { applicationId: string }) {
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Not verified yet</h3>
      <p className="muted small">
        No verification session exists for this application. A pass multiplies the AI screening score; an unverified
        application is ranked on its screening score alone.
      </p>
      <Link href={`/candidate/verification?app=${encodeURIComponent(applicationId)}`}>
        <button>Record a clip</button>
      </Link>
    </div>
  );
}

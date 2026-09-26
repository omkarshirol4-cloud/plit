"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getJson, useRole } from "@/lib/session";

type Health = {
  ok: boolean;
  counts: Record<string, number>;
  services: { verification: string; screening: string };
};

/**
 * Landing page.
 *
 * Two clear doors into the product, and picking one also sets the demo role so
 * the navigation matches where you just went. Service status is shown because a
 * dead ML service silently changes ranking, and a demo should not look broken
 * for that reason.
 */
export default function Home() {
  const router = useRouter();
  const [, setRole] = useRole();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<Health>("/api/health")
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function enter(role: "candidate" | "recruiter") {
    setRole(role);
    router.push(role === "recruiter" ? "/recruiter" : "/candidate");
  }

  return (
    <>
      <div className="trophy-hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 6 }}>Verifiable proof-of-work hiring</h1>
        <p className="sub" style={{ maxWidth: 720, margin: "0 auto" }}>
          Candidates upload a resume and record a short webcam defense. Pre-built ML services rank the resume against
          the role&apos;s required skills and score the recording for off-screen gaze, lip-sync and a second voice.
          Nothing is auto-rejected — anything suspicious is routed to a human.
        </p>
      </div>

      <div className="cards">
        <div className="panel job-card">
          <h3>I&apos;m a candidate</h3>
          <p className="job-card-desc" style={{ WebkitLineClamp: 4 }}>
            Build a profile, upload a resume, apply to roles, take assessments, earn engagement tokens and record a
            webcam verification. Your AI Match Score is computed server-side once screening has run.
          </p>
          <div className="job-card-foot">
            <span className="muted small">8 screens: dashboard, jobs, applications, assessments, rewards, achievements, verification, profile</span>
            <button onClick={() => enter("candidate")}>Enter as candidate</button>
          </div>
        </div>

        <div className="panel job-card">
          <h3>I&apos;m a recruiter</h3>
          <p className="job-card-desc" style={{ WebkitLineClamp: 4 }}>
            Post a role, run the shortlist, and review ranked applicants with a full breakdown of resume score, skills
            match, TF-IDF similarity and live verification signals.
          </p>
          <div className="job-card-foot">
            <span className="muted small">4 screens: dashboard, jobs, applicants, shortlists</span>
            <button onClick={() => enter("recruiter")}>Enter as recruiter</button>
          </div>
        </div>
      </div>

      <div className="section grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>How ranking works</h2>
          <ol className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Your resume is parsed on upload and matched against the role&apos;s required skills.</li>
            <li>A TF-IDF similarity signal is blended in for everything the literal match misses.</li>
            <li>The resulting resume score is multiplied by your verification multiplier: 1.2× pass, 1.0× unverified, 0.5× flagged.</li>
          </ol>
          <p className="muted small" style={{ margin: "12px 0 0" }}>
            Engagement tokens are deliberately not an input to any of this.
          </p>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>How verification works</h2>
          <ol className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Record a short clip of yourself looking at the screen and speaking.</li>
            <li>Gaze, lip-sync and audio are scored independently, then fused.</li>
            <li>A clean pass raises your multiplier; a flag goes to a human reviewer instead of a rejection.</li>
          </ol>
        </div>
      </div>

      <div className="section">
        <h2>System status</h2>
        <div className="panel">
          {!health ? (
            <p className="muted small" style={{ margin: 0 }}>
              Checking the API and ML services&hellip;
            </p>
          ) : (
            <>
              <div className="stat" style={{ marginBottom: 18 }}>
                {Object.entries(health.counts).map(([k, v]) => (
                  <div key={k}>
                    <div className="k">{k.replace(/([A-Z])/g, " $1")}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ML service</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        Verification <span className="muted mono">:8001</span>
                      </td>
                      <td>
                        <span className={`badge ${health.services.verification === "ok" ? "ok" : "err"}`}>
                          {health.services.verification}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        Resume screening <span className="muted mono">:8002</span>
                      </td>
                      <td>
                        <span className={`badge ${health.services.screening === "ok" ? "ok" : "err"}`}>
                          {health.services.screening}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="muted small" style={{ margin: "12px 0 0" }}>
                Direct links: <Link href="/candidate">candidate dashboard</Link> ·{" "}
                <Link href="/recruiter/jobs">recruiter jobs</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

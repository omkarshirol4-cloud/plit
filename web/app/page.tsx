"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getJson, useRole } from "@/lib/session";

type Health = {
  ok: boolean;
  services: { verification: string; screening: string };
};

/**
 * The entry screen, and deliberately nothing more.
 *
 * This page has one job: say what the product is in a sentence, then get out of
 * the way. Everything a first-time visitor needs fits in a single viewport on
 * desktop, so there is no scrolling to discover the two doors into the app.
 *
 * Detail lives on its own pages (/how-it-works, /about) rather than as sections
 * below the fold, which is what kept this short. A previous "Proof of Work /
 * Verification / Discovery" tagline strip was removed as well: it restated the
 * heading and the sentence below it without adding a fact.
 *
 * `useRole` is the existing demo mechanism: choosing a side writes the role to
 * localStorage and routes into it, so the in-app navigation matches where you
 * just went. No auth is faked here.
 */
export default function Home() {
  const router = useRouter();
  const [, setRole] = useRole();
  const [health, setHealth] = useState<Health | null>(null);

  // Ranking depends on two ML services. A demo should not quietly look broken
  // when they are down, so one line of status is kept in the footer -- but it
  // is not worth a section of its own.
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
    <div className="landing">
      <div className="landing-core">
        <h1 className="landing-title">
          Prove your skills.
          <br />
          Get discovered through work.
        </h1>

        <p className="landing-sub">Candidates show what they can do. Recruiters see it before they hire.</p>

        <div className="landing-roles">
          <div className="landing-role">
            <button className="lg" onClick={() => enter("candidate")}>
              I&apos;m a Candidate
            </button>
            <p>Build a profile through verified proof of work.</p>
          </div>

          <div className="landing-role">
            <button className="lg secondary" onClick={() => enter("recruiter")}>
              I&apos;m a Recruiter
            </button>
            <p>Discover candidates through demonstrated skills.</p>
          </div>
        </div>
      </div>

      <div className="landing-foot">
        <span>&copy; PROV</span>
        <span className="landing-status" aria-live="polite">
          {!health ? (
            <span className="muted">Checking services&hellip;</span>
          ) : health.ok ? (
            <span className="muted">Services online</span>
          ) : (
            <span className="badge err">Services degraded &mdash; ranking may be inaccurate</span>
          )}
        </span>
      </div>
    </div>
  );
}

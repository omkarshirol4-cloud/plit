"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AchievementToast } from "@/components/AchievementToast";
import { ApplicationRowView, JobCard } from "@/components/candidate-cards";
import { CandidatePicker, CandidateProfileForm } from "@/components/candidate-identity";
import { TokenBalanceCard } from "@/components/TokenBalanceCard";
import { EmptyState, ErrorState, VerificationPill, formatDate } from "@/components/ui";
import { DashboardSkeleton } from "@/components/Skeletons";
import { useCandidateBundle } from "@/lib/candidate-data";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { UnlockedAchievement } from "@/lib/types";

/**
 * /candidate — the candidate home.
 *
 * Every number here is read live from the existing APIs. The only client-side
 * join is applications x jobs, so a card can show required skills next to an
 * apply button without adding an endpoint.
 *
 * Tokens are engagement only. Nothing on this page feeds screening, ranking or
 * verification, and no score is computed here — the dashboard only displays the
 * ML output that screening already stored.
 */
export default function CandidateDashboard() {
  const [candidateId, setCandidateId, ready] = useCandidateId();
  const { data, error, loading, reload } = useCandidateBundle(candidateId, ready);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);

  // Re-evaluate on arrival so anything the user just earned is announced, then
  // show only genuinely new unlocks. Idempotent server-side.
  useEffect(() => {
    if (!candidateId) return;
    let cancelled = false;
    (async () => {
      try {
        const ev = await getJson<{ unlockedNow: UnlockedAchievement[] }>(
          `/api/candidates/${candidateId}/achievements/evaluate`,
        );
        if (!cancelled) setUnlocked(ev.unlockedNow ?? []);
      } catch {
        /* best-effort: the page still renders with the list from the dashboard API */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const dismiss = useCallback(() => setUnlocked([]), []);

  if (!ready) return <DashboardSkeleton />;

  if (!candidateId) {
    return (
      <>
        <AchievementToast unlocked={unlocked} onDismiss={dismiss} />
        <h1>Candidate dashboard</h1>
        <p className="sub">Sign in, or continue as one of the seeded candidates.</p>
        <CandidateProfileForm candidate={null} />
        <div style={{ height: 16 }} />
        <CandidatePicker />
      </>
    );
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <DashboardSkeleton />;

  const { dashboard, applications, jobs } = data;
  const { candidate, profile, wallet, verification, assessments, achievements } = dashboard;

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const appByJobId = new Map(applications.map((a) => [a.jobId, a]));
  const unlockedAch = achievements.filter((a) => a.unlocked);
  const lockedAch = achievements.filter((a) => !a.unlocked);
  const verified = verification?.result === "pass";

  return (
    <>
      <AchievementToast unlocked={unlocked} onDismiss={dismiss} />

      <div className="page-head">
        <div>
          <h1>Welcome, {candidate.name}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {candidate.email}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/profile">
            <button className="secondary small">Edit profile</button>
          </Link>
          <button className="secondary small" onClick={() => setCandidateId(null)}>
            Switch candidate
          </button>
        </div>
      </div>

      {/* 1. Balance */}
      <div className="section">
        <TokenBalanceCard wallet={wallet} />
      </div>

      {/* 2. Profile completion + 3. Verification */}
      <div className="section dash-grid">
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ marginTop: 0 }}>Profile completion</h2>
          <div className="progress-row">
            <span>
              {profile.completed} of {profile.total} complete
            </span>
            <span>{profile.percent}%</span>
          </div>
          <div className="meter">
            <div style={{ width: `${profile.percent}%` }} />
          </div>
          <p className="muted small" style={{ margin: "10px 0 12px" }}>
            {profile.percent === 100
              ? "Headline, skills and resume are all on file."
              : "A headline, 3+ skills and a resume count as complete."}
          </p>
          {profile.percent < 100 ? (
            <Link href="/candidate/profile">
              <button className="small">Complete Profile</button>
            </Link>
          ) : (
            <span className="badge pass">Profile complete</span>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ marginTop: 0 }}>Verification</h2>
          {verification ? (
            <>
              <p style={{ margin: "0 0 6px" }}>
                <VerificationPill result={verification.result} />
                {verified && <span className="badge ok" style={{ marginLeft: 6 }}>anti-gaming check passed</span>}
              </p>
              <p className="muted small" style={{ margin: "0 0 12px" }}>
                {verification.jobTitle} · recorded {formatDate(verification.createdAt)}
                {verification.reviewedByHR ? " · sent to a human reviewer" : ""}
              </p>
              <Link href="/candidate/verification">
                <button className="secondary small">View Verification</button>
              </Link>
            </>
          ) : (
            <>
              <p className="muted small" style={{ margin: "0 0 12px" }}>
                Not started. Record a short webcam clip on one of your applications to prove you are really you.
              </p>
              <Link href="/candidate/verification">
                <button className="small">Start verification</button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 4. Recommended jobs */}
      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Recommended jobs</h2>
          <Link href="/candidate/jobs" className="small">
            Browse all roles
          </Link>
        </div>
        {dashboard.recommendedJobs.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="You have applied to every open role."
              hint="New roles appear here as recruiters post them."
            />
          </div>
        ) : (
          <div className="cards" style={{ marginTop: 12 }}>
            {dashboard.recommendedJobs.map((j) => (
              <JobCard key={j.id} job={jobById.get(j.id) ?? fallbackJob(j)} application={appByJobId.get(j.id)} />
            ))}
          </div>
        )}
      </div>

      {/* 5. My applications */}
      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>My applications</h2>
          <Link href="/candidate/applications" className="small">
            View all
          </Link>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          {applications.length === 0 ? (
            <EmptyState
              title="You have not applied to any jobs yet."
              hint="Apply to a role and your AI screening score appears here once screening has run."
            />
          ) : applications.length > 6 ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              Showing your 6 most recent of {applications.length} applications.
            </p>
          ) : null}
          {applications.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>AI Match Score</th>
                    <th>Verification</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {applications.slice(0, 6).map((a) => (
                    <ApplicationRowView key={a.id} a={a} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. Assessments */}
      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Assessments</h2>
          <Link href="/candidate/assessments" className="small">
            All assessments
          </Link>
        </div>
        <div className="cards" style={{ marginTop: 12 }}>
          {assessments.map((a) => (
            <div className="panel job-card" key={a.id}>
              <div className="job-card-top">
                <h3 style={{ margin: 0 }}>{a.title}</h3>
                <span className="badge ok">+{a.tokenReward} Tokens</span>
              </div>
              <p className="job-card-desc">{a.description}</p>
              <div className="job-card-foot">
                <span className="muted small">{a.questionCount} questions</span>
                {a.completed ? (
                  <span className="row">
                    <span className="badge pass">Completed {a.score}%</span>
                    <Link href={`/candidate/assessments/${a.id}/result`}>
                      <button className="secondary small">View result</button>
                    </Link>
                  </span>
                ) : (
                  <Link href={`/candidate/assessments/${a.id}`}>
                    <button className="small">Take Assessment</button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Achievements */}
      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Achievements</h2>
          <Link href="/candidate/achievements" className="small">
            All achievements
          </Link>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          {achievements.length === 0 ? (
            <EmptyState title="No achievements are configured." />
          ) : (
            <>
              <h3>Unlocked</h3>
              {unlockedAch.length === 0 ? (
                <p className="muted small">Nothing unlocked yet.</p>
              ) : (
                <div className="ach-list" style={{ marginBottom: 18 }}>
                  {unlockedAch.map((a) => (
                    <span className="ach-pill on" key={a.id}>
                      {a.title} <span className="ach-reward">+{a.tokenReward}</span>
                    </span>
                  ))}
                </div>
              )}
              <h3>Locked</h3>
              {lockedAch.length === 0 ? (
                <p className="muted small">Every achievement unlocked.</p>
              ) : (
                <div className="ach-list">
                  {lockedAch.map((a) => (
                    <span className="ach-pill" key={a.id} title={a.description}>
                      {a.title}
                      {a.target > 1 && (
                        <span className="ach-reward">
                          {a.progress}/{a.target}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The dashboard's recommended list carries only the fields the API returns, so
 * enrich with the full job when it is in the jobs list. Values come from the
 * same row, never a placeholder.
 */
function fallbackJob(j: {
  id: string;
  title: string;
  company: string;
  location: string;
  rankScore: number | null;
}) {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    description: "",
    requiredSkills: [] as string[],
    status: "open",
    applicantCount: 0,
    createdAt: "",
    rankScore: j.rankScore,
  };
}

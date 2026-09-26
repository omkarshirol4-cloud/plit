"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AchievementToast } from "@/components/AchievementToast";
import { EmptyState, ErrorState, NoCandidate, formatDateTime } from "@/components/ui";
import { DashboardSkeleton } from "@/components/Skeletons";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { Achievement, UnlockedAchievement } from "@/lib/types";

/**
 * /candidate/achievements — the full achievement set, split unlocked / locked.
 *
 * Progress comes from the server's real counters, and the evaluate call on
 * arrival is what unlocks anything newly earned. Rewards shown are the values
 * stored on the achievement rows; the client never computes a payout.
 */
export default function AchievementsPage() {
  const [candidateId, , ready] = useCandidateId();
  const [list, setList] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Evaluate first so a milestone reached by a previous action is
        // unlocked and announced, then read the settled state.
        const ev = await getJson<{ unlockedNow: UnlockedAchievement[] }>(
          `/api/candidates/${candidateId}/achievements/evaluate`,
        );
        const a = await getJson<{ achievements: Achievement[] }>(`/api/candidates/${candidateId}/achievements`);
        if (cancelled) return;
        setUnlockedNow(ev.unlockedNow ?? []);
        setList(a.achievements ?? []);
        setError(null);
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

  if (!ready || loading) return <DashboardSkeleton />;
  if (!candidateId)
    return (
      <>
        <h1>Achievements</h1>
        <NoCandidate what="achievements" />
      </>
    );
  if (error) return <ErrorState message={error} />;

  const unlocked = list.filter((a) => a.unlocked).sort((a, b) => a.displayOrder - b.displayOrder);
  const locked = list.filter((a) => !a.unlocked).sort((a, b) => a.displayOrder - b.displayOrder);
  const earned = unlocked.reduce((s, a) => s + a.tokenReward, 0);
  const available = locked.reduce((s, a) => s + a.tokenReward, 0);

  return (
    <>
      <AchievementToast unlocked={unlockedNow} onDismiss={() => setUnlockedNow([])} />

      <div className="page-head">
        <div>
          <h1>Achievements</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {unlocked.length} of {list.length} unlocked · {earned} tokens earned · {available} still available
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/rewards">
            <button className="secondary small">Rewards</button>
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel">
          <EmptyState title="No achievements are configured for this deployment." />
        </div>
      ) : (
        <>
          <div className="section">
            <h2>Unlocked</h2>
            {unlocked.length === 0 ? (
              <div className="panel">
                <EmptyState
                  title="Nothing unlocked yet."
                  hint="Complete your profile, take an assessment or record a verification clip."
                />
              </div>
            ) : (
              <div className="cards">
                {unlocked.map((a) => (
                  <AchievementCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h2>Locked</h2>
            {locked.length === 0 ? (
              <div className="panel">
                <p className="muted" style={{ margin: 0 }}>
                  Every achievement unlocked.
                </p>
              </div>
            ) : (
              <div className="cards">
                {locked.map((a) => (
                  <AchievementCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <p className="muted small">
        Achievement tokens are engagement rewards. They are paid once by the server and never affect screening,
        ranking or verification.
      </p>
    </>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const pct = a.target > 0 ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0;
  return (
    <div className="panel job-card">
      <div className="job-card-top">
        <h3 style={{ margin: 0 }}>
          <span aria-hidden="true">{a.unlocked ? "🏆" : "🔒"}</span> {a.title}
        </h3>
        <span className={"badge " + (a.unlocked ? "ok" : "none")}>{a.unlocked ? "Unlocked" : "Locked"}</span>
      </div>

      <p className="job-card-desc" style={{ WebkitLineClamp: 3 }}>
        {a.description}
      </p>

      {!a.unlocked && a.target > 1 && (
        <div>
          <div className="progress-row">
            <span>Progress</span>
            <span>
              {a.progress}/{a.target}
            </span>
          </div>
          <div className="meter">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="job-card-foot">
        <span className="muted small">
          Reward <span className="mono">+{a.tokenReward}</span> tokens
        </span>
        {a.unlocked && a.unlockedAt ? (
          <span className="muted small">{formatDateTime(a.unlockedAt)}</span>
        ) : a.target <= 1 ? (
          <span className="muted small">one-time</span>
        ) : null}
      </div>
    </div>
  );
}

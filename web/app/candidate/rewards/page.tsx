"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TokenBalanceCard } from "@/components/TokenBalanceCard";
import { TransactionTable } from "@/components/TransactionTable";
import { ErrorState, Loading, NoCandidate, StatCard } from "@/components/ui";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { CandidateWallet, TokenTransaction } from "@/lib/types";

/**
 * /candidate/rewards — balance, lifetime totals and recent ledger activity.
 *
 * Tokens are engagement rewards with no cash value. They never affect screening,
 * ranking or verification, and this build offers nothing to spend them on, so
 * the page says that plainly instead of inventing a shop.
 */
export default function RewardsPage() {
  const [candidateId, , ready] = useCandidateId();
  const [wallet, setWallet] = useState<CandidateWallet | null>(null);
  const [recent, setRecent] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [w, h] = await Promise.all([
          getJson<{ wallet: CandidateWallet }>(`/api/candidates/${candidateId}/tokens`),
          getJson<{ transactions: TokenTransaction[] }>(`/api/candidates/${candidateId}/tokens/history?limit=10`),
        ]);
        if (cancelled) return;
        setWallet(w.wallet);
        setRecent(h.transactions ?? []);
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

  if (!ready || loading) return <Loading label="Loading rewards" />;
  if (!candidateId)
    return (
      <>
        <h1>Rewards</h1>
        <NoCandidate what="rewards" />
      </>
    );
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rewards</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Engagement tokens. No cash value, and they never influence your ranking.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/candidate/achievements">
            <button className="secondary small">Achievements</button>
          </Link>
        </div>
      </div>

      <div className="section">
        <TokenBalanceCard wallet={wallet} />
      </div>

      <div className="section stat-grid">
        <StatCard label="Balance" value={wallet ? wallet.balance : "—"} tone="accent" />
        <StatCard label="Lifetime earned" value={wallet ? wallet.lifetimeEarned : "—"} tone="ok" />
        <StatCard label="Lifetime spent" value={wallet ? wallet.lifetimeSpent : "—"} />
        <StatCard label="Transactions" value={recent.length} sub="most recent 10" />
      </div>

      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>How to earn</h2>
        </div>
        <div className="cards" style={{ marginTop: 12 }}>
          <div className="panel job-card">
            <h3>Complete your profile</h3>
            <p className="job-card-desc">A headline, at least three skills and an uploaded resume.</p>
            <div className="job-card-foot">
              <Link href="/candidate/profile">
                <button className="secondary small">Open profile</button>
              </Link>
            </div>
          </div>
          <div className="panel job-card">
            <h3>Take an assessment</h3>
            <p className="job-card-desc">Each assessment pays its own reward, once, on a valid submission.</p>
            <div className="job-card-foot">
              <Link href="/candidate/assessments">
                <button className="secondary small">See assessments</button>
              </Link>
            </div>
          </div>
          <div className="panel job-card">
            <h3>Complete verification</h3>
            <p className="job-card-desc">Record a webcam clip on an application to prove you are really you.</p>
            <div className="job-card-foot">
              <Link href="/candidate/verification">
                <button className="secondary small">Verify</button>
              </Link>
            </div>
          </div>
          <div className="panel job-card">
            <h3>Unlock achievements</h3>
            <p className="job-card-desc">Milestones across profile, assessments and verification pay a bonus.</p>
            <div className="job-card-foot">
              <Link href="/candidate/achievements">
                <button className="secondary small">See achievements</button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Recent activity</h2>
          <Link href="/candidate/rewards/history" className="small">
            Full history
          </Link>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <TransactionTable
            rows={recent}
            emptyTitle="No activity yet."
            emptyHint="Complete your profile, apply to a job or take an assessment to start earning."
          />
        </div>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";

export type WalletData = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

/**
 * The token balance card, shared by the rewards page and the dashboard so the
 * number is fetched from one place and shown identically in both. It renders
 * whatever the API returns — there is no local fallback value.
 */
export function TokenBalanceCard({ wallet, href = "/candidate/rewards" }: { wallet: WalletData | null; href?: string }) {
  return (
    <div className="panel token-card">
      <div className="token-card-main">
        <div className="token-card-label">🪙 TOKENS</div>
        <div className="token-card-value">{wallet ? wallet.balance : "—"}</div>
        <p className="muted small token-card-blurb">
          Earn tokens by completing your profile, applying to jobs, taking assessments and completing verification.
        </p>
        <Link href={href}>
          <button>View Rewards</button>
        </Link>
      </div>
      <div className="token-card-side">
        <div>
          <div className="token-side-label">Lifetime earned</div>
          <div className="token-side-value">{wallet ? wallet.lifetimeEarned : "—"}</div>
        </div>
        <div>
          <div className="token-side-label">Lifetime spent</div>
          <div className="token-side-value">{wallet ? wallet.lifetimeSpent : "—"}</div>
        </div>
      </div>
    </div>
  );
}

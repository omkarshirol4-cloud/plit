"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TransactionTable } from "@/components/TransactionTable";
import { ErrorState, Loading, NoCandidate } from "@/components/ui";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";
import type { TokenTransaction } from "@/lib/types";

const PAGE_SIZE = 20;

/**
 * /candidate/rewards/history — paginated ledger.
 *
 * Paging is done server-side: the list endpoint takes limit/offset and returns
 * a total, so this only ever holds one page in memory and works for any size
 * of ledger.
 */
export default function RewardsHistoryPage() {
  const [candidateId, , ready] = useCandidateId();
  const [rows, setRows] = useState<TokenTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await getJson<{ transactions?: TokenTransaction[]; total?: number }>(
          `/api/candidates/${candidateId}/tokens/history?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
        );
        if (cancelled) return;
        setRows(d.transactions ?? []);
        setTotal(d.total ?? 0);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setRows([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId, page]);

  if (!ready || loading) return <Loading label="Loading history" />;

  if (!candidateId) {
    return (
      <>
        <h1>Rewards history</h1>
        <NoCandidate what="your transaction history" />
      </>
    );
  }
  if (error && rows.length === 0) return <ErrorState message={error} />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <h1>Rewards history</h1>
      <p className="sub">
        Every token credit and debit, newest first. {total} transaction{total === 1 ? "" : "s"} total.
      </p>

      {error && <div className="msg error">{error}</div>}

      <div className="panel">
        <TransactionTable
          rows={rows}
          emptyTitle={error ? "Could not load your history." : "Nothing here yet."}
          emptyHint={error ? undefined : "Complete your profile to start earning tokens."}
        />

        <div className="row between" style={{ marginTop: 14 }}>
          <span className="muted small">
            Page {page + 1} of {totalPages}
          </span>
          <span className="row">
            <button className="secondary small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </button>
            <button
              className="secondary small"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </span>
        </div>
      </div>

      <Link href="/candidate/rewards">
        <button className="secondary">Back to rewards</button>
      </Link>
    </>
  );
}

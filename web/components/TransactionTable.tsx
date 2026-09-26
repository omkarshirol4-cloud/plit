"use client";

import { EmptyState, formatDateTime } from "@/components/ui";
import type { TokenTransaction } from "@/lib/types";

/** One ledger table, shared by the rewards page and the paginated history. */
export function TransactionTable({
  rows,
  emptyTitle,
  emptyHint,
}: {
  rows: TokenTransaction[];
  emptyTitle: string;
  emptyHint?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Type</th>
            <th>Tokens</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.description || t.type}</td>
              <td className="muted small mono">{t.type}</td>
              <td className={t.amount >= 0 ? "amount-pos mono" : "amount-neg mono"}>
                {t.amount >= 0 ? `+${t.amount}` : t.amount}
              </td>
              <td className="muted small">{formatDateTime(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import Link from "next/link";

/** Shared presentational primitives so every page handles the 4 states the same way. */

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label}&hellip;</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block" role="alert">
      <div className="msg error" style={{ margin: 0, width: "100%" }}>
        {message}
      </div>
      {onRetry && (
        <button className="secondary small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state-block">
      <div className="muted">{title}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

/** No candidate picked yet -- the single most common dead end in this MVP. */
export function NoCandidate({ what = "this page" }: { what?: string }) {
  return (
    <div className="msg info">
      Pick a candidate on the <Link href="/candidate">candidate dashboard</Link> to use {what}.
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn" | "err" | "accent";
}) {
  return (
    <div className={"stat-card" + (tone ? ` stat-card-${tone}` : "")}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export function ScoreCell({ value, digits = 3 }: { value: number | null | undefined; digits?: number }) {
  if (value === null || value === undefined) return <span className="muted small">not screened</span>;
  return <span className="mono">{value.toFixed(digits)}</span>;
}

export function VerificationPill({ result }: { result: string | null | undefined }) {
  if (!result) return <span className="badge none">unverified</span>;
  const cls = result === "pass" ? "pass" : result === "flagged" ? "flagged" : "fail";
  return <span className={`badge ${cls}`}>{result}</span>;
}

/** Human label for an application status straight from the DB. */
export function StatusPill({ status }: { status: string }) {
  const cls = status === "submitted" ? "flagged" : status === "rejected" ? "fail" : "pass";
  return <span className={`badge ${cls}`}>{status}</span>;
}

/**
 * Marks a record the demo seeder created. Deliberately quiet: a small pill
 * rather than a banner, so a screen full of seeded data still reads as the
 * normal product.
 */
export function DemoBadge({ label = "demo" }: { label?: string }) {
  return <span className="badge demo">{label}</span>;
}

/**
 * Explains that a number on screen came from the seed script rather than from
 * a model. Only rendered when seeded rows are actually in view, so it never
 * appears on a screen holding real data.
 */
export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="msg info demo-notice" role="note">
      <strong>Demo data.</strong> {children}
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

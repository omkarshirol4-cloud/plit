/**
 * Skeleton loading primitives.
 *
 * A skeleton is only worth having if it has the same shape as the content it
 * stands in for — otherwise the layout jumps when real data lands, which is
 * worse than a spinner. So each one here mirrors the box model of the matching
 * component in this folder:
 *
 *   StatsSkeleton         -> StatCard
 *   CandidateCardSkeleton -> candidate-cards.tsx
 *   ChallengeCardSkeleton -> the .job-card used on the jobs pages
 *   LeaderboardSkeleton   -> a ranked-token table
 *   ProfileSkeleton       -> the candidate profile form layout
 *   TableSkeleton         -> TransactionTable / any .table-scroll table
 *
 * All animation is a single low-contrast opacity pulse, and the global
 * `prefers-reduced-motion` block turns it off for anyone who asked for that.
 * Every skeleton is aria-hidden, because the surrounding region announces its
 * own busy state to assistive tech — announcing a placeholder twice is noise.
 */

type SkeletonProps = {
  /** Extra inline styles, for the one-off width an instance needs. */
  style?: React.CSSProperties;
  className?: string;
};

/** One grey block. Always decorative — sizing is the caller's job. */
export function Skeleton({ style, className }: SkeletonProps) {
  return <div aria-hidden="true" style={style} className={("skeleton " + (className ?? "")).trim()} />;
}

/** A run of text lines with a ragged last line, so it reads as prose. */
export function SkeletonLines({ lines = 3, widths }: { lines?: number; widths?: number[] }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="line"
          style={{ width: `${widths?.[i] ?? [100, 96, 88, 92, 70][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

/** A panel-sized placeholder that fills its grid cell. */
export function CardSkeleton({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="skel-card" style={{ height: "100%", ...style }} aria-hidden="true">
      {children}
    </div>
  );
}

/** Matches the .stat-grid of StatCard. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skel-stat-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i} style={{ boxShadow: "none" }}>
          <Skeleton className="line" style={{ width: "52%" }} />
          <Skeleton className="line" style={{ width: "34%", height: 22, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

/** Matches candidate-cards.tsx: avatar, name, headline, skill tags. */
export function CandidateCardSkeleton() {
  return (
    <CardSkeleton>
      <div className="skeleton-row">
        <Skeleton className="circle" style={{ width: 40, height: 40, flex: "0 0 auto" }} />
        <div className="skeleton-stack" style={{ flex: "1 1 auto" }}>
          <Skeleton className="line" style={{ width: "45%" }} />
          <Skeleton className="line line-sm" style={{ width: "68%" }} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Skeleton className="line" style={{ width: "30%", height: 9 }} />
      </div>
      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        {[38, 52, 44, 60].map((w, i) => (
          <Skeleton key={i} style={{ width: w, height: 20, borderRadius: 999 }} />
        ))}
      </div>
    </CardSkeleton>
  );
}

/** Matches the .job-card used on /candidate/jobs and /recruiter/jobs. */
export function ChallengeCardSkeleton() {
  return (
    <CardSkeleton>
      <div className="skeleton-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="skeleton-stack" style={{ flex: "1 1 auto" }}>
          <Skeleton className="line" style={{ width: "62%", height: 15 }} />
          <Skeleton className="line line-sm" style={{ width: "44%", marginTop: 4 }} />
        </div>
        <Skeleton style={{ width: 64, height: 22, borderRadius: 999, flex: "0 0 auto" }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Skeleton className="line line-sm" style={{ width: "100%" }} />
        <Skeleton className="line line-sm" style={{ width: "86%", marginTop: 7 }} />
      </div>
      <div className="row" style={{ marginTop: 12, gap: 6 }}>
        {[46, 38, 54, 34].map((w, i) => (
          <Skeleton key={i} style={{ width: w, height: 20, borderRadius: 5 }} />
        ))}
      </div>
      <div
        className="skeleton-row"
        style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", justifyContent: "space-between" }}
      >
        <Skeleton className="line line-sm" style={{ width: 30 }} />
        <Skeleton style={{ width: 76, height: 30, borderRadius: "var(--radius-sm)" }} />
      </div>
    </CardSkeleton>
  );
}

/** A grid of candidate cards, for the discovery pages. */
export function CandidateGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <CandidateCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A grid of job cards, for the jobs pages. */
export function ChallengeGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ChallengeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A ranked list, matching the leaderboard endpoint's shape. */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel" aria-hidden="true">
      <Skeleton className="line" style={{ width: "28%", height: 15, marginBottom: 18 }} />
      <div className="skeleton-stack" style={{ gap: 0 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="skeleton-row"
            style={{
              padding: "13px 0",
              borderBottom: i === rows - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <Skeleton className="circle" style={{ width: 24, height: 24, flex: "0 0 auto" }} />
            <Skeleton className="line" style={{ flex: "1 1 auto", maxWidth: "45%" }} />
            <Skeleton className="line" style={{ width: 48, flex: "0 0 auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches the profile form: heading, text fields, a textarea, a skills area. */
export function ProfileSkeleton() {
  return (
    <div className="grid-2" aria-hidden="true">
      <div className="panel">
        <Skeleton className="line" style={{ width: "34%", height: 15, marginBottom: 20 }} />
        <div className="skeleton-stack" style={{ gap: 16 }}>
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton className="line line-sm" style={{ width: "22%", marginBottom: 7 }} />
              <Skeleton style={{ height: 38, borderRadius: "var(--radius-sm)" }} />
            </div>
          ))}
          <div>
            <Skeleton className="line line-sm" style={{ width: "26%", marginBottom: 7 }} />
            <Skeleton style={{ height: 96, borderRadius: "var(--radius-sm)" }} />
          </div>
        </div>
      </div>
      <div className="panel">
        <Skeleton className="line" style={{ width: "30%", height: 15, marginBottom: 20 }} />
        <div className="skeleton-stack" style={{ gap: 16 }}>
          <div>
            <Skeleton className="line line-sm" style={{ width: "20%", marginBottom: 7 }} />
            <Skeleton style={{ height: 38, borderRadius: "var(--radius-sm)" }} />
          </div>
          <div>
            <Skeleton className="line line-sm" style={{ width: "24%", marginBottom: 7 }} />
            <Skeleton style={{ height: 120, borderRadius: "var(--radius-sm)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A table with a header row and `rows` body rows. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel" aria-hidden="true">
      <div className="table-scroll">
        <table className="skel-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <Skeleton className="line line-sm" style={{ width: i === 0 ? "60%" : "40%" }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <Skeleton className="line" style={{ width: [70, 45, 55, 35, 60][c % 5] + "%" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The verification signal rows: four labelled meters. */
export function VerificationSkeleton() {
  return (
    <div className="panel" aria-hidden="true">
      <Skeleton className="line" style={{ width: "38%", height: 15, marginBottom: 20 }} />
      <div className="skeleton-stack" style={{ gap: 18 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="skeleton-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <Skeleton className="line" style={{ width: 68 }} />
              <Skeleton className="line line-sm" style={{ width: 42 }} />
            </div>
            <Skeleton style={{ height: 6, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The shape of both dashboards: a row of stat cards over two panels.
 * Used wherever a page is mostly statistics plus a couple of supporting blocks.
 */
export function DashboardSkeleton() {
  return (
    <div aria-hidden="true">
      <div style={{ marginBottom: 16 }}>
        <Skeleton className="line" style={{ width: 210, height: 22 }} />
      </div>
      <StatsSkeleton />
      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <Skeleton className="line" style={{ width: "40%", height: 15, marginBottom: 18 }} />
          <SkeletonLines lines={4} />
        </div>
        <div className="panel">
          <Skeleton className="line" style={{ width: "46%", height: 15, marginBottom: 18 }} />
          <SkeletonLines lines={3} />
        </div>
      </div>
    </div>
  );
}

/** A single detail screen: heading block plus one content panel. */
export function DetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div style={{ marginBottom: 16 }}>
        <Skeleton className="line" style={{ width: 260, height: 22 }} />
        <Skeleton className="line" style={{ width: 150, marginTop: 8 }} />
      </div>
      <div className="panel">
        <Skeleton className="line" style={{ width: "36%", height: 15, marginBottom: 20 }} />
        <SkeletonLines lines={5} />
      </div>
    </div>
  );
}

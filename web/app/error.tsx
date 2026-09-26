"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="nf-wrap">
      <h1>Something went wrong</h1>
      <p className="sub">This screen failed to load. The data was not changed.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button onClick={reset}>Try again</button>
        <a href="/candidate">
          <button className="secondary">Candidate dashboard</button>
        </a>
      </div>
    </div>
  );
}

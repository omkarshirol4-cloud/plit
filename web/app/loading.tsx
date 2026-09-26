export default function Loading() {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">Loading&hellip;</span>
    </div>
  );
}

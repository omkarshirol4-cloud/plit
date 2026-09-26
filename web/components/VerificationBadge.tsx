export function VerificationBadge({ result }: { result: string }) {
  const cls = result === "pass" ? "pass" : result === "flagged" ? "flagged" : "fail";
  const label = result === "pass" ? "verified" : result === "flagged" ? "flagged" : "failed";
  return <span className={`badge ${cls}`}>{label}</span>;
}

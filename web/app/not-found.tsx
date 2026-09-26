import Link from "next/link";

export default function NotFound() {
  return (
    <div className="nf-wrap">
      <div className="nf-code">404</div>
      <h1>That page does not exist</h1>
      <p className="sub">The link may be out of date, or the record it pointed at was removed.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/candidate">
          <button>Candidate dashboard</button>
        </Link>
        <Link href="/recruiter">
          <button className="secondary">Recruiter dashboard</button>
        </Link>
      </div>
    </div>
  );
}

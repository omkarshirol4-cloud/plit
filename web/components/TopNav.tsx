"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CANDIDATE_NAV, RECRUITER_NAV, useRole, type Role } from "@/lib/session";

/**
 * Role-aware top navigation.
 *
 * Only the current role's links are rendered, so the two experiences read as
 * separate products rather than one long link dump. The role switcher is
 * deliberately loud: this is a demo with no auth, and a silent switch would
 * look like a bug.
 */
export function TopNav() {
  const [role, setRole, ready] = useRole();
  const pathname = usePathname();
  const router = useRouter();

  // Land people on the right home when they switch sides.
  useEffect(() => {
    if (!ready) return;
    if (role === "candidate" && pathname.startsWith("/recruiter")) router.replace("/candidate");
    if (role === "recruiter" && pathname.startsWith("/candidate")) router.replace("/recruiter");
  }, [ready, role, pathname, router]);

  const links = role === "recruiter" ? RECRUITER_NAV : CANDIDATE_NAV;

  return (
    <header className="top">
      <div className="inner">
        <Link href={role === "recruiter" ? "/recruiter" : "/candidate"} className="brand">
          Proof-of-Work Hiring
        </Link>

        <nav className="role-nav" aria-label={role === "recruiter" ? "Recruiter" : "Candidate"}>
          {ready &&
            links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link key={l.href} href={l.href} className={active ? "nav-link active" : "nav-link"}>
                  {l.label}
                </Link>
              );
            })}
        </nav>

        <span className="spacer" />

        <div className="role-switch" role="group" aria-label="Demo role switcher">
          <span className="muted small">Viewing as</span>
          <RoleButton active={role === "candidate"} onClick={() => setRole("candidate")} role="candidate" />
          <RoleButton active={role === "recruiter"} onClick={() => setRole("recruiter")} role="recruiter" />
        </div>
      </div>
      {ready && (
        <div className="role-banner">
          Demo mode &mdash; no sign-in. You are browsing the{" "}
          <strong>{role === "recruiter" ? "recruiter" : "candidate"}</strong> experience. Use the switcher above to
          change sides.
        </div>
      )}
    </header>
  );
}

function RoleButton({ active, onClick, role }: { active: boolean; onClick: () => void; role: Role }) {
  return (
    <button
      onClick={onClick}
      className={active ? "role-btn active" : "role-btn"}
      aria-pressed={active}
      data-role={role}
    >
      {role === "candidate" ? "Candidate" : "Recruiter"}
    </button>
  );
}

/**
 * Blocks a page behind a role. Used on the recruiter tree so a candidate who
 * follows a stale link gets an explanation and a one-click fix instead of a
 * confusing half-rendered screen.
 */
export function RoleGate({ need, children }: { need: Role; children: React.ReactNode }) {
  const [role, setRole, ready] = useRole();

  if (!ready) {
    return (
      <div className="state-block">
        <span className="muted">Loading&hellip;</span>
      </div>
    );
  }

  if (role !== need) {
    return (
      <div className="panel">
        <h1>{need === "recruiter" ? "Recruiter area" : "Candidate area"}</h1>
        <div className="msg info">
          You are currently browsing as a <strong>{role}</strong>. This page belongs to the{" "}
          <strong>{need}</strong> experience.
        </div>
        <button onClick={() => setRole(need)}>Switch to {need} view</button>
      </div>
    );
  }

  return <>{children}</>;
}

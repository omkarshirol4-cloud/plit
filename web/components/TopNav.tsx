"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CANDIDATE_NAV, RECRUITER_NAV, useRole, type Role } from "@/lib/session";

/**
 * Global navigation, in two modes.
 *
 * Marketing (anything outside the app) shows four things and nothing else:
 * Home, How It Works, About, Get started. A first-time visitor should not be
 * shown dashboard routes before they have chosen a role, so the product links
 * do not exist until a role is picked.
 *
 * Product shows only that role's screens, plus the demo role switcher. There is
 * no auth, so the switcher stays visible rather than pretending to be a
 * signed-in account.
 */

/** Marketing links, shared by the header and the mobile menu. */
const MARKETING_NAV = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
] as const;

export function TopNav() {
  const [role, setRole, ready] = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const inApp = pathname.startsWith("/candidate") || pathname.startsWith("/recruiter");
  const links = role === "recruiter" ? RECRUITER_NAV : CANDIDATE_NAV;

  // Land people on the right home when they switch sides.
  useEffect(() => {
    if (!ready) return;
    if (role === "candidate" && pathname.startsWith("/recruiter")) router.replace("/candidate");
    if (role === "recruiter" && pathname.startsWith("/candidate")) router.replace("/recruiter");
  }, [ready, role, pathname, router]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="top">
      <div className="inner">
        <Link href={inApp ? (role === "recruiter" ? "/recruiter" : "/candidate") : "/"} className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          Proof of Work
        </Link>

        <nav className="nav-desktop" aria-label="Main">
          {inApp
            ? ready &&
              links.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link key={l.href} href={l.href} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}>
                    {l.label}
                  </Link>
                );
              })
            : MARKETING_NAV.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link key={l.href} href={l.href} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}>
                    {l.label}
                  </Link>
                );
              })}
        </nav>

        <span className="spacer" />

        {!inApp ? (
          <Link href="/candidate" className="btn-link nav-cta nav-desktop">
            Get started
          </Link>
        ) : (
          ready && (
            <div className="role-switch" role="group" aria-label="Demo role switcher">
              <RoleButton active={role === "candidate"} onClick={() => setRole("candidate")} role="candidate" />
              <RoleButton active={role === "recruiter"} onClick={() => setRole("recruiter")} role="recruiter" />
            </div>
          )
        )}

        <button className="nav-toggle" aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen((v) => !v)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile menu. Collapsed with display:none, so it is out of the tab order. */}
      <div className={"nav-mobile" + (menuOpen ? " open" : "")} id="mobile-nav">
        <div className="inner">
          {inApp
            ? ready &&
              links.map((l) => (
                <Link key={l.href} href={l.href} className="nav-link">
                  {l.label}
                </Link>
              ))
            : MARKETING_NAV.map((l) => (
                <Link key={l.href} href={l.href} className="nav-link">
                  {l.label}
                </Link>
              ))}

          {inApp ? (
            <>
              <div className="role-switch" role="group" aria-label="Demo role switcher" style={{ marginTop: 8 }}>
                <RoleButton active={role === "candidate"} onClick={() => setRole("candidate")} role="candidate" />
                <RoleButton active={role === "recruiter"} onClick={() => setRole("recruiter")} role="recruiter" />
              </div>
              <Link href="/about" className="nav-link">
                About
              </Link>
            </>
          ) : (
            <Link href="/candidate" className="btn-link nav-cta">
              Get started
            </Link>
          )}
        </div>
      </div>

      {inApp && ready && (
        <div className="role-banner">
          Demo mode &mdash; no sign-in. Viewing the{" "}
          <strong>{role === "recruiter" ? "recruiter" : "candidate"}</strong> experience.
        </div>
      )}
    </header>
  );
}

function RoleButton({ active, onClick, role }: { active: boolean; onClick: () => void; role: Role }) {
  return (
    <button onClick={onClick} className={active ? "role-btn active" : "role-btn"} aria-pressed={active} data-role={role}>
      {role === "candidate" ? "Candidate" : "Recruiter"}
    </button>
  );
}

/**
 * Blocks a recruiter page behind the role. Used by the recruiter tree so a
 * candidate following a stale link gets one sentence and a way out, instead of
 * a half-rendered screen.
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
        <h1>This is the {need} area</h1>
        <p className="muted">You are browsing as a {role}.</p>
        <button onClick={() => setRole(need)}>Switch to {need} view</button>
      </div>
    );
  }

  return <>{children}</>;
}

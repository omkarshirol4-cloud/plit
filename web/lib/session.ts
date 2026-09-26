"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Demo role/session.
 *
 * There is no auth in this MVP, so "who am I" is two localStorage keys: the
 * selected candidate and which side of the product you are looking at. This
 * module is the single place that knows about them, so swapping in a real
 * session later means editing this file and nothing else.
 *
 * This is presentation only. It never gates an API -- every route already
 * validates its own inputs -- it only stops a candidate from wandering into a
 * recruiter screen (and vice versa) during a live demo.
 */
export type Role = "candidate" | "recruiter";

const ROLE_KEY = "hr.role";
const DEFAULT_ROLE: Role = "candidate";

export function useRole(): [Role, (r: Role) => void, boolean] {
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(ROLE_KEY);
    if (stored === "candidate" || stored === "recruiter") setRoleState(stored);
    setReady(true);
  }, []);

  const setRole = useCallback((next: Role) => {
    window.localStorage.setItem(ROLE_KEY, next);
    setRoleState(next);
  }, []);

  return [role, setRole, ready];
}

export const CANDIDATE_NAV = [
  { href: "/candidate", label: "Dashboard" },
  { href: "/candidate/jobs", label: "Jobs" },
  { href: "/candidate/applications", label: "Applications" },
  { href: "/candidate/assessments", label: "Assessments" },
  { href: "/candidate/rewards", label: "Rewards" },
  { href: "/candidate/achievements", label: "Achievements" },
  { href: "/candidate/verification", label: "Verification" },
  { href: "/candidate/profile", label: "Profile" },
] as const;

export const RECRUITER_NAV = [
  { href: "/recruiter", label: "Dashboard" },
  { href: "/recruiter/jobs", label: "Jobs" },
  { href: "/recruiter/applicants", label: "Applicants" },
  { href: "/recruiter/shortlists", label: "Shortlists" },
] as const;

/** Client-side fetch that surfaces the API's own error message. */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

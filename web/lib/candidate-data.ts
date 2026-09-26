"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/session";
import type { Achievement, Candidate } from "@/lib/types";

/**
 * One place that assembles the candidate's real data from existing endpoints.
 *
 * Pages compose from these rather than each inventing its own fetch, so the
 * dashboard, jobs list and applications table can never disagree about whether
 * a job was applied to. Everything here is a read; no endpoint is modified.
 */

export type Wallet = { balance: number; lifetimeEarned: number; lifetimeSpent: number };

export type DashboardPayload = {
  candidate: Candidate & { hasResume: boolean; resumeName: string | null };
  profile: { percent: number; completed: number; total: number };
  wallet: Wallet;
  verification: {
    result: string;
    reviewedByHR: boolean;
    applicationId: string;
    jobTitle: string;
    createdAt: string;
  } | null;
  recommendedJobs: { id: string; title: string; company: string; location: string; rankScore: number | null }[];
  assessments: {
    id: string;
    title: string;
    description: string;
    tokenReward: number;
    questionCount: number;
    completed: boolean;
    score: number | null;
  }[];
  achievements: Achievement[];
};

export type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requiredSkills: string[];
  status: string;
  applicantCount: number;
  createdAt: string;
};

export type ApplicationRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  status: string;
  createdAt: string;
  verificationResult: string | null;
  screeningRankScore: number | null;
  screeningMultiplier: number | null;
};

export type CandidateBundle = {
  dashboard: DashboardPayload;
  applications: ApplicationRow[];
  jobs: JobRow[];
};

async function loadBundle(candidateId: string): Promise<CandidateBundle> {
  const [dashboard, apps, jobs] = await Promise.all([
    getJson<DashboardPayload>(`/api/candidates/${candidateId}/dashboard`),
    getJson<{ applications: ApplicationRow[] }>(`/api/applications?candidateId=${encodeURIComponent(candidateId)}`),
    getJson<{ jobs: JobRow[] }>("/api/jobs"),
  ]);
  return { dashboard, applications: apps.applications ?? [], jobs: jobs.jobs ?? [] };
}

/**
 * Loads the candidate bundle. Re-runs whenever the selected candidate changes,
 * and exposes `reload` so pages can refresh after an action (apply, submit).
 */
export function useCandidateBundle(candidateId: string | null, ready: boolean) {
  const [data, setData] = useState<CandidateBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!candidateId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await loadBundle(candidateId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return { data, error, loading, reload: load, setData };
}

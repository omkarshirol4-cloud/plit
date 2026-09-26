"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/session";
import type { ApplicationRow, JobRow } from "@/lib/candidate-data";

/**
 * Recruiter reads.
 *
 * The recruiter side needs every job and every application, which the existing
 * endpoints already expose. Composing them here keeps the dashboard, applicants
 * and shortlists pages consistent with each other, and avoids inventing an
 * aggregate endpoint.
 */
export type RecruiterBundle = {
  jobs: JobRow[];
  applications: ApplicationRow[];
};

export function useRecruiterData() {
  const [data, setData] = useState<RecruiterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        getJson<{ jobs: JobRow[] }>("/api/jobs"),
        getJson<{ applications: ApplicationRow[] }>("/api/applications"),
      ]);
      setData({ jobs: j.jobs ?? [], applications: a.applications ?? [] });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Per-job rollups used by the dashboard and the shortlists index. */
export type JobRollup = JobRow & {
  applicants: ApplicationRow[];
  screened: number;
  verified: number;
  flagged: number;
  bestRankScore: number | null;
};

export function rollupByJob(data: RecruiterBundle | null): JobRollup[] {
  if (!data) return [];
  return data.jobs.map((job) => {
    const applicants = data.applications.filter((a) => a.jobId === job.id);
    const scores = applicants
      .map((a) => a.screeningRankScore)
      .filter((s): s is number => typeof s === "number");
    return {
      ...job,
      applicants,
      screened: scores.length,
      verified: applicants.filter((a) => a.verificationResult === "pass").length,
      flagged: applicants.filter((a) => a.verificationResult === "flagged" || a.verificationResult === "fail").length,
      bestRankScore: scores.length ? Math.max(...scores) : null,
    };
  });
}

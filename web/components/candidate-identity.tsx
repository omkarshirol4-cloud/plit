"use client";

import { useEffect, useState } from "react";
import { useCandidateId } from "@/lib/client";
import { getJson } from "@/lib/session";

export { CandidateProfileForm } from "@/components/CandidateProfileForm";

/**
 * Candidate switcher for the demo. There is no password, so "sign in" means
 * choosing a row. Ordered most-recent-first by the API.
 */
export function CandidatePicker() {
  const [, setCandidateId] = useCandidateId();
  const [rows, setRows] = useState<{ id: string; name: string; email: string; resumeName: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<{ candidates: typeof rows }>("/api/candidates")
      .then((d) => {
        if (!cancelled) setRows(d.candidates ?? []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="msg error">{error}</div>;
  if (rows.length === 0) return null;

  return (
    <div className="panel">
      <h3>Or continue as an existing candidate</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Resume</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="mono small">{c.email}</td>
                <td>
                  {c.resumeName ? <span className="badge ok">on file</span> : <span className="badge none">none</span>}
                </td>
                <td>
                  <button className="small" onClick={() => setCandidateId(c.id)}>
                    select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

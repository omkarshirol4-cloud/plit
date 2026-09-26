"use client";

import { useEffect, useState } from "react";

const KEY = "hr.candidateId";

/**
 * No auth in the MVP (per the hackathon rules): the "logged in" candidate is
 * just an id in localStorage. Swap this module for a real session later
 * without touching any page.
 */
export function useCandidateId(): [string | null, (id: string | null) => void, boolean] {
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setId(window.localStorage.getItem(KEY));
    setReady(true);
  }, []);

  const update = (next: string | null) => {
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
    setId(next);
  };

  return [id, update, ready];
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`);
  return data as T;
}

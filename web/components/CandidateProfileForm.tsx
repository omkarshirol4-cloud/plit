"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCandidateId, postJson } from "@/lib/client";
import type { Candidate } from "@/lib/types";

/**
 * Create-or-edit candidate profile, plus resume upload.
 *
 * One component for both the signed-out case (no candidate selected) and the
 * signed-in case, so signing up is always one click away and the field list can
 * never drift between the two.
 */
export function CandidateProfileForm({ candidate }: { candidate: Candidate | null }) {
  const router = useRouter();
  const [, setCandidateId] = useCandidateId();
  const [headline, setHeadline] = useState(candidate?.headline ?? "");
  const [skills, setSkills] = useState((candidate?.skills ?? []).join(", "));
  const [name, setName] = useState(candidate?.name ?? "");
  const [email, setEmail] = useState(candidate?.email ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  // Re-seed the fields when the selected candidate changes underneath us.
  useEffect(() => {
    setHeadline(candidate?.headline ?? "");
    setSkills((candidate?.skills ?? []).join(", "));
    setName(candidate?.name ?? "");
    setEmail(candidate?.email ?? "");
    setMsg(null);
    setFile(null);
  }, [candidate?.id, candidate?.headline, candidate?.skills, candidate?.name, candidate?.email]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = await postJson<{ candidate: Candidate }>("/api/candidates", { name, email, headline, skills });
      setCandidateId(d.candidate.id);
      setMsg({ kind: "ok", text: `Profile created. Welcome, ${d.candidate.name}.` });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ headline, skills }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "save failed");
      setMsg({ kind: "ok", text: "Profile saved." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    if (!file) {
      setMsg({ kind: "error", text: "Choose a file first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/candidates/${candidate.id}/resume`, { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "upload failed");
      setMsg({ kind: "ok", text: `Parsed ${d.characters} characters from ${d.resumeName}.` });
      setFile(null);
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!candidate) {
    return (
      <div className="panel">
        <h3>Create a candidate profile</h3>
        <p className="muted small">No password in the demo — pick an identity and move on.</p>
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="c-name">Full name</label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="c-headline">Headline</label>
            <input
              id="c-headline"
              placeholder="Senior Backend Engineer"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="c-skills">Skills (comma separated)</label>
            <input
              id="c-skills"
              placeholder="Python, PostgreSQL, Kubernetes"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create profile"}
          </button>
        </form>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="grid-2">
        <div className="panel">
          <h3>Details</h3>
          <form onSubmit={save}>
            <div className="field">
              <label>Full name</label>
              <input value={candidate.name} disabled />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={candidate.email} disabled />
            </div>
            <div className="field">
              <label htmlFor="p-headline">Headline</label>
              <input id="p-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="p-skills">Skills (comma separated)</label>
              <input id="p-skills" value={skills} onChange={(e) => setSkills(e.target.value)} />
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save details"}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3>Resume</h3>
          {candidate.resumeName ? (
            <p className="small" style={{ marginTop: 0 }}>
              On file: <span className="mono">{candidate.resumeName}</span>{" "}
              <span className="muted">({(candidate.resumeText ?? "").length} chars parsed)</span>
            </p>
          ) : (
            <p className="muted small" style={{ marginTop: 0 }}>
              No resume yet. The shortlister needs parsed resume text to rank you.
            </p>
          )}
          <form onSubmit={upload}>
            <div className="field">
              <label htmlFor="resume">Upload .pdf, .docx or .txt</label>
              <input
                id="resume"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" disabled={busy || !file}>
              {busy ? "Uploading…" : "Upload resume"}
            </button>
          </form>
        </div>
      </div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </>
  );
}

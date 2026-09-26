"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoleGate } from "@/components/TopNav";
import { postJson } from "@/lib/client";

export default function NewJob() {
  return (
    <RoleGate need="recruiter">
      <NewJobForm />
    </RoleGate>
  );
}

function NewJobForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await postJson<{ job: { id: string } }>("/api/jobs", {
        title,
        company,
        location,
        description,
        requiredSkills: skills,
      });
      router.push(`/recruiter/jobs/${d.job.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Post a job</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Required skills drive the resume screening — the shortlister matches them literally against each parsed
            resume, then blends in a TF-IDF similarity signal.
          </p>
        </div>
        <div className="page-actions">
          <button className="secondary" onClick={() => router.push("/recruiter/jobs")}>
            Cancel
          </button>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 640 }}>
        <form onSubmit={submit}>
          {error && <div className="msg error">{error}</div>}
          <div className="field">
            <label htmlFor="title">Job title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="company">Company</label>
              <input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="location">Location</label>
              <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="skills">Required skills (comma separated)</label>
            <input
              id="skills"
              placeholder="Python, PostgreSQL, Kubernetes, AWS, Docker"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create job"}
          </button>
        </form>
      </div>
    </>
  );
}

/**
 * Thin HTTP client for the two pre-built Python ML services.
 *
 * Deliberately not an in-process import: the web app must stay runnable
 * with nothing but `npm install`, and during a demo you want to be able
 * to restart one service without rebuilding the other.
 *
 *   ML_VERIFY_URL    -> ml/verification/service.py   (port 8001)
 *   ML_SHORTLIST_URL -> resume_screening/service.py  (port 8002)
 */

export const ML_VERIFY_URL = process.env.ML_VERIFY_URL ?? "http://localhost:8001/verify";
export const ML_SHORTLIST_URL = process.env.ML_SHORTLIST_URL ?? "http://localhost:8002/shortlist";
export const ML_EXTRACT_URL =
  process.env.ML_EXTRACT_URL ?? ML_SHORTLIST_URL.replace(/\/shortlist$/, "/extract");

const TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 300_000);

export class MlServiceError extends Error {
  constructor(
    message: string,
    readonly service: string,
  ) {
    super(message);
    this.name = "MlServiceError";
  }
}

async function postJson<T>(url: string, service: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new MlServiceError(
      `${service} is not reachable at ${url} (${(err as Error).message}). ` +
        `Start it, then retry.`,
      service,
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new MlServiceError(`${service} returned ${res.status}: ${text.slice(0, 400)}`, service);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MlServiceError(`${service} returned non-JSON: ${text.slice(0, 400)}`, service);
  }
}

export type ShortlistApplicant = {
  applicationId: string;
  candidateId: string;
  name: string;
  resumeText: string;
  verificationResult: string | null;
};

export type ShortlistRow = {
  rank: number;
  applicationId: string;
  candidateId: string;
  name: string;
  resumeScore: number;
  skillsScore: number;
  tfidfScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  verificationResult: string | null;
  verificationMultiplier: number;
  rankScore: number;
  jobId?: string;
};

export async function runShortlist(
  jobId: string,
  requiredSkills: string[],
  applicants: ShortlistApplicant[],
): Promise<ShortlistRow[]> {
  const data = await postJson<{ results: ShortlistRow[] }>(
    ML_SHORTLIST_URL,
    "resume screening service",
    { jobId, requiredSkills, applicants },
  );
  return data.results ?? [];
}

/** Extracts plain text from an uploaded resume at upload time. */
export async function extractResumeText(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);

  let res: Response;
  try {
    res = await fetch(ML_EXTRACT_URL, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new MlServiceError(
      `resume screening service is not reachable at ${ML_EXTRACT_URL} (${(err as Error).message}). ` +
        `Start it with: uvicorn resume_screening.service:app --port 8002`,
      "resume screening service",
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new MlServiceError(
      `resume screening service could not parse ${filename} (${res.status}): ${text.slice(0, 300)}`,
      "resume screening service",
    );
  }
  try {
    return String((JSON.parse(text) as { text: string }).text ?? "");
  } catch {
    throw new MlServiceError(`resume screening service returned non-JSON: ${text.slice(0, 300)}`, "resume screening service");
  }
}

/**
 * Forwards a recorded webcam clip to the verification service.
 *
 * Note the service does NOT return the stored session -- it POSTs the
 * canonical payload to /api/verification-sessions itself (see
 * ml/verification/service.py). So by the time this resolves, the row is
 * already in SQLite; we re-read it rather than trusting the echo.
 */
export async function runVerification(
  submissionId: string,
  clip: Blob,
  filename: string,
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("submission_id", submissionId);
  form.append("clip", clip, filename);

  let res: Response;
  try {
    res = await fetch(ML_VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new MlServiceError(
      `verification service is not reachable at ${ML_VERIFY_URL} (${(err as Error).message}). ` +
        `Start it with: uvicorn ml.verification.service:app --port 8001`,
      "verification service",
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new MlServiceError(`verification service returned ${res.status}: ${text.slice(0, 400)}`, "verification service");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new MlServiceError(`verification service returned non-JSON: ${text.slice(0, 400)}`, "verification service");
  }
}

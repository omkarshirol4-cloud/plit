/**
 * Demo markers, in one client-safe module.
 *
 * Both sides of the app need to agree on what "synthetic" looks like: the
 * seeder writes rows under these markers, and the UI has to be able to label
 * them without pulling the whole dataset (or `node:sqlite`) into the browser
 * bundle. So the markers live here, in a module with no imports at all, and
 * `demo-data.ts` re-exports them.
 */

/**
 * Every primary key the seed creates starts with this, and `reset:demo` deletes
 * exactly these rows and nothing else.
 *
 * Real rows are created by `newId()` and are therefore always `cand_*`,
 * `job_*`, `app_*`, `vs_*`, `sl_*`, `att_*`, `tok_*`, `wal_*`, `cach_*` or
 * `achv_*`. No real id can begin with `demo_`, which is what makes the reset
 * safe.
 */
export const DEMO_PREFIX = "demo_";

/**
 * Stamped onto the synthetic screening scores, which are the one artefact with
 * no schema column to hold a marker. It lives in the row id, so any question
 * about a seeded score is answerable from the database alone.
 */
export const DEMO_SEED_REF = "demo_seed_2026";

/** Candidate email domain. Reserved, non-routable, never a real inbox. */
export const DEMO_EMAIL_DOMAIN = "demo.local";

/**
 * SQL predicate for "this row belongs to the demo seed".
 *
 * `GLOB` rather than `LIKE`, because in `LIKE` an underscore is a
 * single-character wildcard, so `'demo_%'` would also match an id like
 * `demox1`. In `GLOB` the underscore is literal and only `*` is a wildcard.
 */
export const DEMO_ID_GLOB = "demo_*";

/** Whether an id was created by the demo seed. */
export function isDemoId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(DEMO_PREFIX);
}

/** Whether a record was created by the demo seed, judged by its email. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** Wording shown wherever seeded numbers are displayed. */
export const DEMO_SCORE_NOTE =
  "Demo data. These screening scores are deterministic fixtures written by " +
  "npm run seed:demo — they are not output from the resume-screening model. " +
  "The scoring arithmetic, ranking and tokens are real.";

export const DEMO_VERIFICATION_NOTE =
  "Demo data. These verification signals are hand-picked constants from the seed " +
  "script. No camera, microphone or verification model produced them, and none " +
  "of it is biometric data.";

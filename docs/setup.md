# PROV — Setup

Exact instructions to get PROV running from a clean clone. Every command here
was run against this repository; the versions listed are the versions it was
verified on.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Install](#2-install)
3. [Environment variables](#3-environment-variables)
4. [Database setup](#4-database-setup)
5. [Demo data: seed and reset](#5-demo-data-seed-and-reset)
6. [Run the three services](#6-run-the-three-services)
7. [Verify the stack is healthy](#7-verify-the-stack-is-healthy)
8. [Tests](#8-tests)
9. [Build and typecheck](#9-build-and-typecheck)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum | Verified on | Why |
| --- | --- | --- | --- |
| **Node.js** | **22.6** | v26.7.0 | `node:sqlite` (`DatabaseSync`) needs 22.5+; the seed and test scripts use `--experimental-strip-types`, which needs 22.6+ |
| **npm** | 10+ | 11.19.0 | Ships with Node |
| **Python** | **3.10** | 3.13.14 | FastAPI + uvicorn + mediapipe + librosa |
| **ffmpeg** | any recent | 9.0.2 | Required on `PATH` for audio demux in the verification service |
| **ffprobe** | any recent | 9.0.2 | Used by `ml/verification/oep_adapter.py` |

> **Node 22.5 will not work.** The database is `node:sqlite`, a **Node builtin**.
> There is no `better-sqlite3` and no native compile step, so there is nothing
> to fall back to. On Node 20 you will get a module-not-found error on
> `node:sqlite`.

### Install ffmpeg

```bash
# Windows (winget)
winget install --id Gyan.FFmpeg -e

# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg
```

Confirm it is on `PATH`:

```bash
ffmpeg -version
ffprobe -version
```

### Optional: lip-sync model (SyncNet)

The lip-sync signal needs a local `syncnet_python` checkout. It is **not
vendored** and is gitignored. Without it the signal returns a neutral `0.5` and
says so in diagnostics — the pipeline still runs, by design.

```bash
git clone https://github.com/joonson/syncnet_python.git
export SYNCNET_REPO_DIR=/absolute/path/to/syncnet_python   # Linux/macOS
$env:SYNCNET_REPO_DIR = "C:\path\to\syncnet_python"        # PowerShell
```

SyncNet also expects its weights under `syncnet_python/data/`. Follow that
repository's own instructions.

---

## 2. Install

From the repository root.

### Python services

```bash
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

`requirements.txt` lists 9 packages:

```
fastapi
uvicorn[standard]
python-multipart
requests
opencv-python-headless
mediapipe
librosa
numpy
scipy
```

> ### ⚠️ Two required packages are missing from `requirements.txt`
>
> The code imports **`scikit-learn`** (`resume_screening/score.py`) and
> **`pypdf`** (`resume_screening/extract_text.py`). Neither is listed. Without
> them `:8002` will fail on the first `/shortlist` or `/extract` call.
>
> **Install them explicitly:**
>
> ```bash
> pip install -r requirements.txt scikit-learn pypdf
> ```
>
> This is a known gap in our dependency manifest, recorded in
> [limitations.md](limitations.md#1-missing-python-dependencies). We have not
> edited `requirements.txt` as part of this documentation submission, but it
> should be fixed before anyone deploys this.

### Web app

```bash
cd web
npm install
```

Only **3 runtime dependencies** — `next`, `react`, `react-dom`. The database is a
Node builtin, so there is no native module to compile and no postinstall step to
fail.

---

## 3. Environment variables

**All of them are optional.** Every value has a working default, so PROV runs
with no `.env` file at all. There is no `.env.example` in this repository and
you do not need one.

### Set by the web app (`web/`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `<cwd>/data/hr.db` | SQLite file location. Resolves to `web/data/hr.db` under `npm run dev`. |
| `ML_VERIFY_URL` | `http://localhost:8001/verify` | Verification ML endpoint |
| `ML_SHORTLIST_URL` | `http://localhost:8002/shortlist` | Screening ML endpoint |
| `ML_EXTRACT_URL` | `ML_SHORTLIST_URL` with `/shortlist` → `/extract` | Resume text extraction |
| `ML_TIMEOUT_MS` | `300000` | 5 minutes. Verification is CPU-bound and slow; do not lower this. |
| `ML_HEALTH_VERIFY` | `http://localhost:8001/health` | Health probe target |
| `ML_HEALTH_SCREENING` | `http://localhost:8002/health` | Health probe target |
| `NODE_ENV` | — | Selects `distDir`: `.next` in dev, `.next-build` otherwise |
| `CDP_PORT` | `9222` | Only used by `web/measure.mjs`, a dev tool |

### Set by the verification service (`:8001`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_BASE_URL` | `http://localhost:3000` | **Must point at the web app.** The service POSTs results to `${BACKEND_BASE_URL}/api/verification-sessions`. If this is wrong the result is never stored. |
| `SYNCNET_REPO_DIR` | *(unset)* | Path to a `syncnet_python` checkout. Unset ⇒ lip-sync returns a neutral `0.5` with a diagnostic note. |

### Set by the test suites (repo root)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE` | `http://localhost:3000` | Target web app for the `*-test.mjs` suites |

### The one that bites

`BACKEND_BASE_URL` is the only one you will realistically need to set, and
getting it wrong produces a confusing 502. If `/api/applications/[id]/verify`
returns *"the verification service scored the clip but could not save the
result"*, this is why. `start-demo.cmd` sets it for you.

---

## 4. Database setup

**There is nothing to set up.** The schema is created and migrated
automatically.

- The database is **`node:sqlite`**, a Node builtin. No ORM, no migrations tool,
  no `prisma migrate`, no seed SQL file.
- `web/lib/db.ts` runs an idempotent `CREATE TABLE IF NOT EXISTS` migration on
  **every** `getDb()` call — not only at connect — so a cached dev connection
  picks up new tables.
- 15 tables, WAL mode, foreign keys `ON DELETE CASCADE`.
- Seed reference data (3 assessments, 6 achievements) is inserted with
  `ON CONFLICT DO NOTHING`, so **an existing row always wins** and operator
  edits are never clobbered.

**Default location:** `web/data/hr.db`, created on first access. The `data/`
directory and its WAL/SHM siblings are gitignored.

**To use a different location:**

```bash
# Windows PowerShell
$env:DATABASE_PATH = "C:\temp\prov-test.db"

# bash
export DATABASE_PATH=/tmp/prov-test.db
```

**To start completely fresh**, stop the web server and delete the file:

```bash
rm web/data/hr.db web/data/hr.db-wal web/data/hr.db-shm   # bash
Remove-Item web\data\hr.db*, web\data\hr.db-shm -ErrorAction SilentlyContinue  # PowerShell
```

The schema and seed data are recreated on next start. **This deletes
everything, including any data you created by hand.** If you want to remove only
the demo rows, use `npm run reset:demo` instead.

> **Note on the schema comment.** `web/lib/db.ts` says the database "lives
> outside `web/`". With `npm run dev` it actually resolves to `web/data/hr.db`
> because `process.cwd()` is `web/`. The comment is stale; the behaviour is as
> documented here.

---

## 5. Demo data: seed and reset

### Seed

```bash
cd web
npm run seed:demo
```

Seeds a **synthetic** dataset for the fictional employer *NovaHire Technologies*:

| Rows | Count |
| --- | --- |
| Candidates | 10 |
| Jobs | 5 |
| Applications | 33 |
| Verifications | 7 |
| Skill-verification sessions | 5 (3 challenges each) |
| Assessments | 11 |
| Achievements | 34 |
| Token transactions | 108 |

Expected output ends with:

```
DEMO DATA SEEDED
...
All names, emails, resumes, verification signals and screening scores are synthetic.
Screening scores are demo seed values (demo_seed_2026), not ML output.
Verification signals are synthetic constants, not biometric measurements.
Reset with: npm run reset:demo
```

Re-running is safe — it refreshes existing `demo_*` rows rather than duplicating
them. No server, no browser, no ML service and no network are required.

> **Every name, email, resume, screening score and verification signal in this
> dataset is fabricated.** The scoring arithmetic, ranking and token logic around
> them are real. See [ai.md §10](../ai.md#10-synthetic-and-demo-data).

### Reset

```bash
cd web
npm run reset:demo
```

Deletes only rows matching `id GLOB 'demo_*'`, then prints per-table counts and
a **non-demo leak check**:

```
Non-demo rows deleted (must be 0):
```

The script **exits non-zero if any real row was deleted.** It uses `GLOB`, not
`LIKE`, because in `LIKE` an underscore is a single-character wildcard and would
over-match genuine rows.

### A note on the `seed` script

`package.json` also defines:

```json
"seed": "node --experimental-strip-types scripts/seed.ts"
```

**This script does not exist** and `npm run seed` will fail with
`MODULE_NOT_FOUND`. The working commands are `npm run seed:demo` and
`npm run reset:demo`. This is a known defect in the manifest, recorded in
[limitations.md](limitations.md#2-broken-npm-run-seed-script).

---

## 6. Run the three services

PROV is three processes. All three must be running for a complete demo.

### Option A — Windows one-liner

```bash
start-demo.cmd
```

Opens three console windows (screening, verification, web) and prints
`http://localhost:3000`. **It hardcodes an ffmpeg path** for this machine; edit
line 4 if ffmpeg lives elsewhere.

### Option B — three terminals

**Terminal 1 — resume screening on `:8002`**

```bash
# from the repository root, with the venv active
.\.venv\Scripts\python.exe -m uvicorn resume_screening.service:app --port 8002
```

```bash
# bash
.venv/bin/python -m uvicorn resume_screening.service:app --port 8002
```

**Terminal 2 — verification ML on `:8001`**

```bash
# PowerShell — BACKEND_BASE_URL is required
$env:BACKEND_BASE_URL = "http://localhost:3000"
.\.venv\Scripts\python.exe -m uvicorn ml.verification.service:app --port 8001
```

```bash
# bash
export BACKEND_BASE_URL=http://localhost:3000
.venv/bin/python -m uvicorn ml.verification.service:app --port 8001
```

**Terminal 3 — Next.js on `:3000`**

```bash
cd web
npm run dev
```

### Production build

```bash
cd web
npm run build
npm run start        # next start -p 3000
```

`next.config.mjs` sets `distDir` to `.next-build` outside development, so a
production build cannot overwrite a running dev server's chunks.

### The demo path

Open <http://localhost:3000> → choose the **Candidate** role → any demo
candidate → **Skill verification** → *Start 30-minute verification*.

Then switch to the **Recruiter** role → **Jobs** → open a role → *Run
shortlist*. The full 3-minute path is in
[resource.md §4](../resource.md#4-the-3-minute-reviewer-path).

---

## 7. Verify the stack is healthy

```bash
curl http://localhost:3000/api/health
```

```json
{
  "ok": true,
  "counts": { "candidates": 10, "jobs": 5, "applications": 33,
              "shortlistResults": 0, "verificationSessions": 7 },
  "services": { "verification": "ok", "screening": "ok" }
}
```

Both ML services are probed **in parallel with a 2500 ms timeout**. A service
that is down reports its name:

```json
"services": { "verification": "unreachable (fetch failed)", "screening": "ok" }
```

Individual service health can also be checked directly:

```bash
curl http://localhost:8001/health    # {"status":"ok"}
curl http://localhost:8002/health    # {"status":"ok"}
```

> **If `verification` is unreachable, that is usually not a bug.** It means the
> FastAPI app on `:8001` failed to start — most often a missing `scikit-learn`
> or `pypdf` at import time, or `ffmpeg` not on `PATH`. Read the traceback in
> terminal 2.

---

## 8. Tests

All test suites are plain Node scripts with hand-rolled assertions. There is no
test framework.

### Verification flow — no services needed

```bash
cd web
npm run test:verification
```

**15 labelled steps / 72 assertions**, all at the module level against a **temporary database**. No
HTTP, no Next.js, no ML service. Covers curation, determinism, the 30-minute
timer, resume-does-not-reset, server-side scoring, duplicate submit, cross-session
rejection, cross-candidate isolation, integrity-as-separate-axis, the vocabulary
check, and server-clock expiry.

Exits `0` if all pass, `1` on any failure.

### Full suite — needs the web app on `:3000`

```bash
cd web
npm test
```

Runs, in order:

1. `npm run test:verification`
2. `node ../tokens-test.mjs` — 9 steps including *"Client cannot choose the
   amount"* and *"Duplicate event prevention"*
3. `node ../achievements-test.mjs` — 12 steps including *"Never rewarded twice"*
   and *"Direct earn cannot forge an achievement"*
4. `node ../assessments-test.mjs` — 10 steps including *"Answer key never
   reaches the client"* and *"Client cannot dictate reward or score"*

> **Do not restart the ML services while these run.** The root suites carry the
> note *"Do not touch the ML services"* — they create and mutate rows.

### End-to-end — needs all three services

```bash
cd web
npm run test:e2e
```

Runs `e2e-test.mjs`: candidate signup → resume upload through `:8002`
`/extract` → recruiter creates a job → candidates apply → recruiter triggers
shortlist through `:8002` → recruiter reads the ranked list → verification
results stored → re-run shortlist applies the verification multiplier →
recruiter sees the badge and signal breakdown → a live clip through `:8001` →
pages render.

It uses native `fetch` / `FormData` / `Blob` so multipart uploads go out
exactly the way a browser sends them.

### Python self-test

```bash
python -m resume_screening.selftest
```

Not pytest — a hand-rolled smoke test that asserts a known ordering of four
fixture applicants.

### Pointing the tests at a different host

```bash
BASE=http://localhost:3000 node tokens-test.mjs   # bash
$env:BASE = "http://localhost:3000"; node tokens-test.mjs   # PowerShell
```

---

## 9. Build and typecheck

```bash
cd web

npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run build         # next build
```

| Script | Command |
| --- | --- |
| `dev` | `next dev -p 3000` |
| `build` | `next build` |
| `start` | `next start -p 3000` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `test:verification` → `tokens-test.mjs` → `achievements-test.mjs` → `assessments-test.mjs` |
| `test:verification` | `node --experimental-strip-types scripts/verification-flow-test.ts` |
| `test:e2e` | `node e2e-test.mjs` (from the repo root) |
| `seed:demo` | `node scripts/seed-demo.ts` |
| `reset:demo` | `node scripts/reset-demo.ts` |
| `seed` | **broken** — `scripts/seed.ts` does not exist |

---

## 10. Troubleshooting

### `Cannot find module 'node:sqlite'`

Your Node is too old. `node:sqlite` needs **22.5+**, and the seed/test scripts
need **22.6+** for `--experimental-strip-types`. Check with `node --version`.

### `ModuleNotFoundError: No module named 'sklearn'` (or `'pypdf'`)

Both are imported by the code but missing from `requirements.txt`:

```bash
pip install scikit-learn pypdf
```

### `verification service is not reachable at http://localhost:8001/verify`

The service on `:8001` is not running, or crashed at import. Read the traceback
in that terminal. Usually a missing package or ffmpeg not on `PATH`.

### `the verification service scored the clip but could not save the result`

`BACKEND_BASE_URL` is not pointing at the web app. The service scored the clip
successfully but could not POST the result back. Set it and restart `:8001`:

```bash
$env:BACKEND_BASE_URL = "http://localhost:3000"
```

### `/verify` returns 422 `could not extract audio`

ffmpeg is not on `PATH`, or the clip has no audio track. Check `ffmpeg -version`.

### Lip-sync always returns exactly `0.5`

`SYNCNET_REPO_DIR` is unset, or the checkout has no weights. This is
**expected and correct** — the signal reports itself as unavailable rather than
guessing. It is visible in the `diagnostics` block of the `/verify` response.

### Every API route fails with `MODULE_NOT_FOUND` after a build

A production build and a dev server are sharing `.next`. `next.config.mjs`
prevents this by using `.next-build` outside development — but if you built with
`NODE_ENV` unset, it may have used the dev directory. Stop everything, delete
`web/.next` and `web/.next-build`, and restart.

### The countdown looks wrong, or a session will not start

The web app on `:3000` must be running. `GET /api/verification-sessions/start`
returns `serverNow` and `remainingSeconds` computed by the **server**; the UI
derives its countdown from those. Without a running server there is no session
to resume and the button does nothing.

### Windows: "too many open files" or refused database handles

The SQLite connection is cached on `globalThis` precisely to avoid this — Next
re-evaluates modules on every hot reload. If you see it, something is bypassing
`getDb()`; check that no code opened its own `DatabaseSync`.

---

## Further reading

| Document | Covers |
| --- | --- |
| [../README.md](../README.md) | Product overview and quick start |
| [../resource.md](../resource.md) | Team, live MVP details, 3-minute reviewer path |
| [../ai.md](../ai.md) | Every model and algorithm, honestly |
| [architecture.md](architecture.md) | Real architecture, real paths, component diagram |
| [constraints.md](constraints.md) | The constraints this build holds to |
| [limitations.md](limitations.md) | Known defects and what this cannot do |
| [../README-mvp.md](../README-mvp.md) | Original MVP notes *(pre-existing)* |
| [../README-ml-anti-gaming.md](../README-ml-anti-gaming.md) | Original verification-ML notes *(pre-existing)* |

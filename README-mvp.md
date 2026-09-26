# PROV — MVP

PROV: resume screening + live anti-gaming verification. Next.js web app over two
pre-built Python ML services, SQLite for storage.

## Architecture

```
Candidate browser ─┐
                   ├─> Next.js :3000 ──API routes──> SQLite (web/data/hr.db)
Recruiter browser ─┘         │
                             ├─> resume screening service  :8002  (TF-IDF + skills)
                             └─> verification service       :8001  (gaze + lipsync + audio)
```

The browser never talks to Python directly. The verification service calls
back into `POST /api/verification-sessions` to persist its own result —
that payload shape is fixed by `ml/verification/fusion.py`.

## Services

| Port | What | Source |
|---|---|---|
| 3000 | Next.js app + API | `web/` |
| 8001 | Anti-gaming verification | `ml/verification/service.py` (pre-existing) |
| 8002 | Resume screening | `resume_screening/service.py` |

## Setup (already done on this machine)

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pypdf
winget install --id Gyan.FFmpeg -e     # ffmpeg is required by the ML services
cd web && npm install
```

## Run

Three terminals, or just `start-demo.cmd`:

```bash
# 1. resume screening
.\.venv\Scripts\python.exe -m uvicorn resume_screening.service:app --port 8002

# 2. verification service (BACKEND_BASE_URL must point at the web app)
$env:BACKEND_BASE_URL = "http://localhost:3000"
.\.venv\Scripts\python.exe -m uvicorn ml.verification.service:app --port 8001

# 3. web
cd web && npm run dev
```

Then open <http://localhost:3000>.

## Test

```bash
# full end-to-end flow against a running stack (74 assertions)
node e2e-test.mjs

# resume-screening pipeline in isolation
.\.venv\Scripts\python.exe -m resume_screening.selftest

# typecheck / build
cd web && npx tsc --noEmit && npm run build
```

## Walkthrough

1. `/candidate` — create a candidate, upload a `.pdf`/`.docx`/`.txt` resume.
   Text is extracted by the screening service on :8002.
2. `/candidate/jobs` — apply to a role.
3. `/recruiter/jobs/new` — post a job with required skills.
4. `/recruiter/jobs/<id>` — **Run shortlist**. Ranks applicants by
   `0.7 × skills + 0.3 × TF-IDF`, then multiplies by the verification
   multiplier (pass 1.2×, unverified 1.0×, flagged/fail 0.5×).
5. `/candidate/applications` — **Record clip** (webcam + mic, up to 20s).
   Goes to :8001, which scores gaze / lip-sync / audio, fuses them, and
   posts the result back.
6. Back on the recruiter's shortlist page — the verification badge and
   per-signal breakdown fill in automatically. `detail` shows both.

## Notes / known limits

- **Lip-sync needs `SYNCNET_REPO_DIR`** pointing at a
  [joonson/syncnet_python](https://github.com/joonson/syncnet_python)
  checkout. Without it that signal returns a neutral `0.5` and says so in
  the diagnostics — the pipeline still runs, by design. Vendoring SyncNet
  (torch + model weights) was out of scope for the MVP.
- **No auth.** The "signed-in" candidate is an id in `localStorage`.
- **`pass`/`flagged`/`fail` never auto-reject.** Anything that isn't a
  clean pass sets `reviewedByHR` and waits for a human.
- Uploads and the SQLite file live in `web/.uploads` and `web/data`; both
  are gitignored.

### Fix applied to pre-existing ML code

`ml/verification/lipsync.py` called `_repo_dir()` outside its own `try`, so
an unset `SYNCNET_REPO_DIR` raised `LipSyncError` past the module's
"fail neutral" handler and 500'd `/verify`. The call was moved inside the
`try` — the fix the module's docstring already described. No thresholds,
weights, or scoring logic were changed.

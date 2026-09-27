# Screenshots to capture before submission

**There are currently no screenshots in this repository.** No image file exists
anywhere in the project, and **we have not generated any.**

Fabricating a screenshot — or using a mockup that looks like a screenshot — would
be the single easiest way to lose a reviewer's trust in everything else we have
claimed. Every image below must be a **real capture of the running application**.

This file is the capture plan. When the screenshots are taken, save them in this
directory using the exact filenames given, then tick each box.

---

## Before you start

**1. All three services must be running** — see [../setup.md](../setup.md).

**2. Seed the demo data:**

```bash
cd web && npm run seed:demo
```

**3. Use these exact demo records**, so a reviewer can reproduce every shot:

| What | Value |
| --- | --- |
| Employer | *NovaHire Technologies* (fictional) |
| Recruiter | Aarav Mehta `<recruiter@novahire.demo>` |
| Job — data | **Junior Data Analyst** — Python, SQL, Excel, Data Analysis, Statistics |
| Job — psychology | **Psychology Research Intern** — Research Methods, Statistics, SPSS, Report Writing, Psychology |
| Job — design | **UI/UX Design Intern** — Figma, UI Design, UX Research, Prototyping |
| Job — HR | **HR & Recruitment Intern** — Communication, Recruitment, Interviewing, MS Office, HR Fundamentals |
| Job — marketing | **Marketing Associate** — Digital Marketing, Content Writing, Communication, Social Media, Analytics |
| Candidates | Ananya Rao, Rohan Kapoor, Meera Nair, Arjun Shah, Kavya Menon, Ishaan Verma, Diya Kulkarni, Aditya Joshi, Nisha Patel, Rahul Iyer (all `@demo.local`) |

**4. Capture conditions:**

- Browser window at a consistent size — **1440 × 900** is a good default
- **Demo the "synthetic demo" badge clearly.** Do not crop it out. It is part of
  the honesty of the product.
- Hide browser chrome and any personal tabs, bookmarks or extensions
- Do not include real names, emails or windows from your own machine
- Prefer a light background; PROV's UI is designed for it

**5. Every screenshot must be a real capture of the running app.** No mockups, no
redrawn UI, no placeholder text.

---

## The required set

Nine screenshots. Grouped by what a reviewer needs to see, in the order they
should read them.

---

### 1. `01-landing.png` — Entry point

| | |
| --- | --- |
| **URL** | `http://localhost:3000/` |
| **Shows** | The PROV landing page and the candidate / recruiter role selection |
| **Must be visible** | The product name, the tagline, and both role options |
| **Why** | It is the first thing a reviewer sees. It should be obvious within two seconds what this is. |

---

### 2. `02-candidate-dashboard.png` — Candidate home

| | |
| --- | --- |
| **URL** | `http://localhost:3000/candidate` |
| **Role** | Candidate |
| **Shows** | Profile completeness, wallet balance, recommended jobs, assessments, achievements |
| **Must be visible** | A demo candidate's name and `@demo.local` email |
| **Why** | Establishes that the candidate surface is real and populated, not a mock. |

---

### 3. `03-skill-verification-challenges.png` — **The core shot**

| | |
| --- | --- |
| **URL** | `http://localhost:3000/candidate/skill-verification` |
| **Role** | Candidate |
| **Action** | Press **Start 30-minute verification**, then answer challenge 1 |
| **Shows** | All three challenges, their skills, the answer textarea, the submit button, and the **countdown timer** |
| **Must be visible** | **Three** challenge panels · the countdown in `mm:ss` · the **"synthetic demo"** badge if the session is seeded |
| **Why** | This is the product in one image: exactly three skill-specific challenges under a 30-minute clock. |

**Tip:** capture this one with the countdown under 5 minutes if you can — the
timer turns amber and the label changes to *"less than 5 minutes left"*. A second
capture of that state is worth having.

---

### 4. `04-skill-verification-result.png` — Performance and integrity, separately

| | |
| --- | --- |
| **URL** | `http://localhost:3000/candidate/skill-verification` |
| **Role** | Candidate |
| **Action** | Submit all three answers, then let the result panel render |
| **Shows** | The result panel with **challenge performance** and **integrity** as two separate figures, the final result label, time taken, and the integrity-event table |
| **Must be visible** | Both figures, clearly **not** merged into one number · the closing line: *"These are two separate measurements."* |
| **Why** | This is the architectural commitment, made visible. If you only capture one screenshot, capture this one. |

---

### 5. `05-refresh-resumes-same-clock.png` — Server-authoritative expiry

| | |
| --- | --- |
| **URL** | `http://localhost:3000/candidate/skill-verification` |
| **Role** | Candidate |
| **Action** | Start a session, note the countdown, **reload the page**, and capture immediately after |
| **Shows** | The same session resumed, with the **same** deadline and the same unsubmitted challenges |
| **Must be visible** | An unsubmitted challenge still marked as available |
| **Why** | Proves the 30 minutes is server-owned. A refresh does not hand out 30 more minutes. |

**Suggested pairing:** capture the countdown *before* and *after* the reload and
put them side by side. That single image is the most persuasive thing in the
whole set.

---

### 6. `06-recruiter-shortlist.png` — ML screening with a real breakdown

| | |
| --- | --- |
| **URL** | `http://localhost:3000/recruiter/jobs` → open **Junior Data Analyst** |
| **Role** | Recruiter |
| **Action** | Press **Run shortlist** and wait for `:8002` to respond |
| **Shows** | The ranked applicant table with the score breakdown — resume score, skills score, TF-IDF score, rank score — plus matched and missing skills |
| **Must be visible** | The per-component breakdown, not just a total · the `DEMO_SCORE_NOTE` notice explaining the seeded scores are fixtures · *"Verification multiplies the result; tokens never do."* |
| **Why** | Shows the screening ML is real and that scores are auditable rather than opaque. |

> **Make sure you press *Run shortlist* first.** Until you do, the scores on
> screen are the synthetic seed fixtures. After you do, they are genuine model
> output from `:8002` — which is the whole point of the shot. The
> `DEMO_SCORE_NOTE` will still be visible, because the *candidates* are still
> synthetic; that is correct and should stay in frame.

---

### 7. `07-recruiter-two-axis-evidence.png` — **The money shot**

| | |
| --- | --- |
| **URL** | `http://localhost:3000/recruiter/candidates/[applicationId]` |
| **Role** | Recruiter |
| **Shows** | The applicant record: score breakdown, stored verification result, and the **Skill verification** panel |
| **Must be visible** | **Challenge performance** and **Integrity signals** as two independent large figures · the per-challenge table · the per-signal integrity event table · the note that tokens are not shown because they play no part in ranking |
| **Why** | This is what a recruiter actually sees, and it is where the separation of performance from integrity does its job. |

**Best candidate for this shot:** someone with a **flagged or review** integrity
status, if you can produce one. A panel showing *"Worth a human look"* next to a
strong performance score is far more persuasive than two clean green numbers.

---

### 8. `08-synthetic-demo-notice.png` — Honesty, in the UI

| | |
| --- | --- |
| **URL** | `http://localhost:3000/recruiter/shortlists` |
| **Role** | Recruiter |
| **Shows** | The demo notice and the `DEMO_SCORE_NOTE` banner on the shortlist overview |
| **Must be visible** | The full text: *"Demo data. These screening scores are deterministic fixtures written by `npm run seed:demo` — they are not output from the resume-screening model."* |
| **Why** | Demonstrates that the product labels its own synthetic data. A reviewer who sees this is far more likely to believe the numbers that *are* real. |

**Do not crop this out of any other screenshot either.**

---

### 9. `09-api-health.png` — The stack is real

| | |
| --- | --- |
| **URL** | `http://localhost:3000/api/health` |
| **Shows** | Raw JSON: `"ok": true`, row counts, and `"verification": "ok"`, `"screening": "ok"` |
| **Why** | Proves three services are genuinely running, not mocked in the UI. A screenshot of the health endpoint is much harder to fake than a screenshot of a dashboard. |

**Both services must report `ok`.** If either says `unreachable`, fix it before
capturing.

---

## Optional but valuable

Capture these if time allows.

| Filename | URL / action | Shows |
| --- | --- | --- |
| `10-verification-diagnostics.png` | `POST` a recorded clip to `/api/applications/[id]/verify`, or capture the response | The `diagnostics` block with per-signal readings — and, if `SYNCNET_REPO_DIR` is unset, lip-sync honestly reporting a neutral `0.5` |
| `11-assessment-result.png` | `/candidate/assessments` → take one | A server-scored result with the persisted reward |
| `12-achievements.png` | `/candidate/achievements` | Locked and unlocked achievements with progress |
| `13-rewards-history.png` | `/candidate/rewards/history` | The paginated token ledger — evidence that balances are derived, not assigned |
| `14-recruiter-dashboard.png` | `/recruiter` | Open roles, applicants, verified, needs-review counts |
| `15-how-it-works.png` | `/how-it-works` | The product's own explanation of the flow |
| `16-empty-states.png` | A job with no ranked applicants | *"awaiting screening"* — honest empty states, never a fake `0.000` or `N/A` |

---

## Capture checklist

- [ ] All three services running; `/api/health` reports `ok` for both
- [ ] `npm run seed:demo` run; `npm run reset:demo` verified to work
- [ ] Browser at a consistent size, personal chrome hidden
- [ ] **Every** screenshot shows the synthetic-demo labelling where it applies
- [ ] No real names, emails, or personal data anywhere in frame
- [ ] `04` clearly shows performance and integrity as two separate figures
- [ ] `05` shows the resumed session, not a fresh 30 minutes
- [ ] `06` was captured **after** pressing *Run shortlist*
- [ ] `07` shows the two-axis recruiter view in full
- [ ] `09` shows both ML services reporting `ok`
- [ ] All files saved into `docs/images/` with the exact names above
- [ ] `README.md`, `resource.md` and `ai.md` updated to reference the new files

---

## Referencing the screenshots in the docs

Once captured, add them to **[../../README.md](../../README.md)** in the
architecture and solution sections, and to
**[../../resource.md](../../resource.md) §5** in the submission-materials table,
replacing the `TBD` screenshot row.

Use relative paths, for example:

```markdown
![Performance and integrity shown separately](../../docs/images/04-skill-verification-result.png)
```

---

## A note on what not to screenshot

Please **do not** capture:

- Anything with a real person's face or name
- Your browser tabs, bookmarks, extensions or OS chrome
- A terminal window showing your username or machine paths
- Any screen containing credentials, tokens or `.env` contents
- A mockup, a Figma render, or a redrawn version of the UI

If a screenshot would expose something private, skip it. The nine required shots
above are all capturable from seeded synthetic data with no privacy risk.

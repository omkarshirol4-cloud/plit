/**
 * Achievements — test suite.
 *
 *   node achievements-test.mjs
 *
 * The load-bearing property is "never the same reward twice", checked three
 * ways: repeated evaluation, concurrent evaluation, and the raw ledger.
 *
 * Expects Next.js on :3000. Does not touch the ML services.
 */
const BASE = process.env.BASE ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;
const step = (n) => console.log(`\n${cyan(`=== ${n} ===`)}`);

function check(label, cond, extra) {
  if (cond) {
    console.log(`  ${green("PASS")}  ${label}`);
    pass++;
  } else {
    console.log(`  ${red("FAIL")}  ${label}  ${dim(JSON.stringify(extra ?? ""))}`);
    fail++;
  }
}

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, ok: res.ok, body: json };
}
const GET = (u) => req("GET", u);
const POST = (u, b) => req("POST", u, b);

const stamp = Date.now();

async function newCandidate(label) {
  const r = await POST("/api/candidates", {
    name: `Ach ${label}`,
    email: `ach-${label}-${stamp}@example.com`,
    headline: "Backend Engineer",
    skills: "Python, PostgreSQL, Kubernetes",
  });
  return r.body.candidate.id;
}

async function uploadResume(id) {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["Ach Probe. Senior Backend Engineer. Skills: Python, Go, PostgreSQL, Kubernetes, AWS, Docker."], {
      type: "text/plain",
    }),
    "resume.txt",
  );
  await fetch(`${BASE}/api/candidates/${id}/resume`, { method: "POST", body: form });
}

const walletOf = async (id) => (await GET(`/api/candidates/${id}/tokens`)).body.wallet;
const achOf = async (id) => (await GET(`/api/candidates/${id}/achievements`)).body.achievements;
const byCode = (list, code) => list.find((a) => a.code === code);
const evaluate = (id) => POST(`/api/candidates/${id}/achievements/evaluate`);
const ledger = async (id) => (await GET(`/api/candidates/${id}/tokens/history?limit=200`)).body.transactions;
const achTxns = async (id) => (await ledger(id)).filter((t) => t.type === "ACHIEVEMENT");

// ============================================================ 1. definitions
step("1. Achievement definitions");
const unknownAch = await GET("/api/candidates/cand_nope/achievements");
check("unknown candidate -> 404", unknownAch.status === 404, unknownAch.body);

const c1 = await newCandidate("defs");
const list = await achOf(c1);
check("all six achievements defined", list.length === 6, list.map((a) => a.code));

const CODES = [
  "FIRST_APPLICATION",
  "PROFILE_COMPLETE",
  "VERIFIED_CANDIDATE",
  "FIRST_ASSESSMENT",
  "ACTIVE_JOB_SEEKER",
  "CONSISTENT_CANDIDATE",
];
for (const code of CODES) {
  const a = byCode(list, code);
  check(`${code} exists with title + reward`, Boolean(a?.title) && a?.tokenReward > 0, a);
}
check("FIRST_APPLICATION is 'First Step' +10", byCode(list, "FIRST_APPLICATION")?.title === "First Step" && byCode(list, "FIRST_APPLICATION")?.tokenReward === 10, byCode(list, "FIRST_APPLICATION"));
check("PROFILE_COMPLETE is 'Profile Ready' +20", byCode(list, "PROFILE_COMPLETE")?.tokenReward === 20, byCode(list, "PROFILE_COMPLETE"));
check("VERIFIED_CANDIDATE is 'Verified' +25", byCode(list, "VERIFIED_CANDIDATE")?.tokenReward === 25, byCode(list, "VERIFIED_CANDIDATE"));
check("FIRST_ASSESSMENT is 'Test Ready' +20", byCode(list, "FIRST_ASSESSMENT")?.tokenReward === 20, byCode(list, "FIRST_ASSESSMENT"));
check("ACTIVE_JOB_SEEKER is +25", byCode(list, "ACTIVE_JOB_SEEKER")?.tokenReward === 25, byCode(list, "ACTIVE_JOB_SEEKER"));
check("CONSISTENT_CANDIDATE is +30", byCode(list, "CONSISTENT_CANDIDATE")?.tokenReward === 30, byCode(list, "CONSISTENT_CANDIDATE"));

const fresh = await newCandidate("fresh");
const freshList = await achOf(fresh);
check("brand-new candidate has nothing unlocked", freshList.every((a) => !a.unlocked), freshList.filter((a) => a.unlocked));
check("profile incomplete shows progress", byCode(freshList, "PROFILE_COMPLETE")?.progress === 0, byCode(freshList, "PROFILE_COMPLETE"));
check("applications progress starts at 0", byCode(freshList, "ACTIVE_JOB_SEEKER")?.progress === 0, byCode(freshList, "ACTIVE_JOB_SEEKER"));
check("5 applications needed for ACTIVE_JOB_SEEKER", byCode(freshList, "ACTIVE_JOB_SEEKER")?.target === 5, byCode(freshList, "ACTIVE_JOB_SEEKER"));

// ============================================================ 2. PROFILE_COMPLETE
step("2. PROFILE_COMPLETE");
const c2 = await newCandidate("profile");
check("PROFILE_COMPLETE locked before resume", byCode(await achOf(c2), "PROFILE_COMPLETE")?.unlocked === false, "expected locked");
await uploadResume(c2);
await req("PATCH", `/api/candidates/${c2}`, { headline: "Backend Engineer", skills: "Python, PostgreSQL, Kubernetes" });
const afterProfile = await evaluate(c2);
check("evaluate reports PROFILE_COMPLETE as newly unlocked", afterProfile.body.unlockedNow?.some((u) => u.code === "PROFILE_COMPLETE"), afterProfile.body.unlockedNow);
const list2 = await achOf(c2);
check("  PROFILE_COMPLETE now unlocked", byCode(list2, "PROFILE_COMPLETE")?.unlocked === true, byCode(list2, "PROFILE_COMPLETE"));
check("  unlockedAt is a timestamp", Boolean(byCode(list2, "PROFILE_COMPLETE")?.unlockedAt), byCode(list2, "PROFILE_COMPLETE"));
const w2 = await walletOf(c2);
check("  wallet credited +20", w2.balance === 20, w2);
const pTxns = await achTxns(c2);
check("  one ACHIEVEMENT ledger row", pTxns.length === 1, pTxns);
check("  ledger referenceId is the achievement code", pTxns[0]?.referenceId === "PROFILE_COMPLETE", pTxns[0]);
check("  ledger amount is the configured reward", pTxns[0]?.amount === 20, pTxns[0]);

// ============================================================ 3. never twice
step("3. Never rewarded twice");
const before = await walletOf(c2);
const repeats = [];
for (let i = 0; i < 5; i++) repeats.push(await evaluate(c2));
check("repeat evaluate returns no new unlocks", repeats.every((r) => r.body.unlockedNow?.length === 0), repeats.map((r) => r.body.unlockedNow?.length));
check("balance unchanged after 5 re-evaluations", (await walletOf(c2)).balance === before.balance, {
  before: before.balance,
  after: (await walletOf(c2)).balance,
});
check("still exactly one PROFILE_COMPLETE row", (await achTxns(c2)).filter((t) => t.referenceId === "PROFILE_COMPLETE").length === 1, await achTxns(c2));

// Concurrent evaluation: 20 parallel POSTs must still pay once.
const c3 = await newCandidate("race");
await uploadResume(c3);
await req("PATCH", `/api/candidates/${c3}`, { headline: "Backend Engineer", skills: "Python, PostgreSQL, Kubernetes" });
await Promise.all(Array.from({ length: 20 }, () => evaluate(c3)));
const raceTxns = (await achTxns(c3)).filter((t) => t.referenceId === "PROFILE_COMPLETE");
check("20 parallel evaluates pay exactly once", raceTxns.length === 1, raceTxns.length);
check("  balance is 20 after the race", (await walletOf(c3)).balance === 20, await walletOf(c3));
const raceList = await achOf(c3);
check("  one PROFILE_COMPLETE unlock row", raceList.filter((a) => a.code === "PROFILE_COMPLETE").length === 1, "duplicate definition rows?");

// ============================================================ 4. FIRST_APPLICATION
step("4. FIRST_APPLICATION");
const job = (await POST("/api/jobs", { title: "Ach Test Role", company: "Acme", requiredSkills: "Python" })).body.job;
const c4 = await newCandidate("apply");
const app1 = await POST("/api/applications", { candidateId: c4, jobId: job.id });
check("application created", app1.status === 201, app1.body);
await evaluate(c4);
let l4 = await achOf(c4);
check("FIRST_APPLICATION unlocked after 1 application", byCode(l4, "FIRST_APPLICATION")?.unlocked === true, byCode(l4, "FIRST_APPLICATION"));
check("  +10 credited", (await walletOf(c4)).balance === 10, await walletOf(c4));
check("  ACTIVE_JOB_SEEKER still locked at 1/5", byCode(l4, "ACTIVE_JOB_SEEKER")?.unlocked === false && byCode(l4, "ACTIVE_JOB_SEEKER")?.progress === 1, byCode(l4, "ACTIVE_JOB_SEEKER"));

// ============================================================ 5. ACTIVE_JOB_SEEKER at 5
step("5. ACTIVE_JOB_SEEKER");
const c5 = await newCandidate("five");
const jobs = [];
for (let i = 0; i < 5; i++) {
  const j = (await POST("/api/jobs", { title: `Role ${i}`, company: "Acme", requiredSkills: "Python" })).body.job;
  jobs.push(j);
  await POST("/api/applications", { candidateId: c5, jobId: j.id });
}
const e5 = await evaluate(c5);
const codes5 = e5.body.unlockedNow.map((u) => u.code);
check("both FIRST_APPLICATION and ACTIVE_JOB_SEEKER unlock", codes5.includes("FIRST_APPLICATION") && codes5.includes("ACTIVE_JOB_SEEKER"), codes5);
const l5 = await achOf(c5);
check("  ACTIVE_JOB_SEEKER unlocked", byCode(l5, "ACTIVE_JOB_SEEKER")?.unlocked === true, byCode(l5, "ACTIVE_JOB_SEEKER"));
check("  +10 +25 = 35 credited", (await walletOf(c5)).balance === 35, await walletOf(c5));
const t5 = await achTxns(c5);
check("  exactly 2 ACHIEVEMENT rows", t5.length === 2, t5.map((t) => t.referenceId));
check("  distinct referenceIds", new Set(t5.map((t) => t.referenceId)).size === 2, t5.map((t) => t.referenceId));

// ============================================================ 6. VERIFIED_CANDIDATE
step("6. VERIFIED_CANDIDATE");
const c6 = await newCandidate("verify");
const job6 = (await POST("/api/jobs", { title: "Verify Role", company: "Acme", requiredSkills: "Python" })).body.job;
const app6 = (await POST("/api/applications", { candidateId: c6, jobId: job6.id })).body.application;
await evaluate(c6);
let l6 = await achOf(c6);
check("VERIFIED_CANDIDATE locked with no session", byCode(l6, "VERIFIED_CANDIDATE")?.unlocked === false, byCode(l6, "VERIFIED_CANDIDATE"));

// A failing session must not unlock it.
await POST("/api/verification-sessions", {
  submissionId: app6.id,
  gazeScore: 0.2,
  lipSyncScore: 0.1,
  audioScore: 0.2,
  result: "fail",
  reviewedByHR: true,
});
await evaluate(c6);
l6 = await achOf(c6);
check("still locked after a failed verification", byCode(l6, "VERIFIED_CANDIDATE")?.unlocked === false, byCode(l6, "VERIFIED_CANDIDATE"));

// A different application passes.
const app6b = (await POST("/api/applications", { candidateId: c6, jobId: jobs[0].id })).body.application;
await POST("/api/verification-sessions", {
  submissionId: app6b.id,
  gazeScore: 0.9,
  lipSyncScore: 0.9,
  audioScore: 0.9,
  result: "pass",
  reviewedByHR: false,
});
await evaluate(c6);
l6 = await achOf(c6);
check("unlocked after a passing verification", byCode(l6, "VERIFIED_CANDIDATE")?.unlocked === true, byCode(l6, "VERIFIED_CANDIDATE"));
const verTxns = (await achTxns(c6)).filter((t) => t.referenceId === "VERIFIED_CANDIDATE");
check("  exactly one VERIFIED_CANDIDATE payout", verTxns.length === 1, verTxns);
check("  +25 credited", verTxns[0]?.amount === 25, verTxns[0]);

// ============================================================ 7. FIRST_ASSESSMENT
step("7. FIRST_ASSESSMENT");
const c7 = await newCandidate("assess");
const asm = (await GET("/api/assessments")).body.assessments[0];
await POST(`/api/assessments/${asm.id}/start`, { candidateId: c7 });
const sub7 = await POST(`/api/assessments/${asm.id}/submit`, {
  candidateId: c7,
  answers: Object.fromEntries(Array.from({ length: asm.questionCount }, (_, i) => [`q${i + 1}`, 0])),
});
check("assessment submit returns achievementsUnlocked", sub7.body.achievementsUnlocked?.some((u) => u.code === "FIRST_ASSESSMENT"), sub7.body.achievementsUnlocked);
const l7 = await achOf(c7);
check("  FIRST_ASSESSMENT unlocked", byCode(l7, "FIRST_ASSESSMENT")?.unlocked === true, byCode(l7, "FIRST_ASSESSMENT"));
const faTxns = (await achTxns(c7)).filter((t) => t.referenceId === "FIRST_ASSESSMENT");
check("  exactly one FIRST_ASSESSMENT payout", faTxns.length === 1, faTxns);

// ============================================================ 8. direct earn cannot forge an achievement
step("8. Direct earn cannot forge an achievement");
const c8 = await newCandidate("forge");
const fake = await POST(`/api/candidates/${c8}/tokens/earn`, { type: "ACHIEVEMENT", referenceId: "VERIFIED_CANDIDATE" });
check("earn ACHIEVEMENT with an unearned code -> 409", fake.status === 409, fake.body);
check("  code = ACHIEVEMENT_NOT_UNLOCKED", fake.body.code === "ACHIEVEMENT_NOT_UNLOCKED", fake.body);
check("  no tokens granted", (await walletOf(c8)).balance === 0, await walletOf(c8));

const arbitrary = await POST(`/api/candidates/${c8}/tokens/earn`, { type: "ACHIEVEMENT", referenceId: "totally_made_up" });
check("earn ACHIEVEMENT with an invented code -> 409", arbitrary.status === 409, arbitrary.body);
check("  balance still 0", (await walletOf(c8)).balance === 0, await walletOf(c8));

// A genuinely unlocked one pays exactly once even via the direct route.
const c9 = await newCandidate("legit");
await uploadResume(c9);
await evaluate(c9);
const already = (await walletOf(c9)).balance;
const again = await POST(`/api/candidates/${c9}/tokens/earn`, { type: "ACHIEVEMENT", referenceId: "PROFILE_COMPLETE" });
check("re-earning an unlocked achievement does not pay twice", again.body.awarded === false, again.body);
check("  balance unchanged", (await walletOf(c9)).balance === already, { before: already, after: (await walletOf(c9)).balance });

// ============================================================ 9. evaluate endpoint hygiene
step("9. Evaluate endpoint");
check("evaluate for unknown candidate -> 404", (await evaluate("cand_nope")).status === 404, "expected 404");
const noBody = await evaluate(c1);
check("evaluate needs no body", noBody.ok, noBody.body);
check("evaluate returns a wallet summary", typeof noBody.body.wallet?.balance === "number", noBody.body.wallet);
check("evaluate returns an unlockedNow array", Array.isArray(noBody.body.unlockedNow), noBody.body.unlockedNow);

// ============================================================ 10. notification contract
// The UI toast renders title/description/tokenReward directly off these objects,
// so a server-side rename would blank the banner rather than fail loudly here.
step("10. Notification contract (drives the UI toast)");
const cN = await newCandidate("notify");
const jobN = (await POST("/api/jobs", { title: "Notify Role", company: "Acme", requiredSkills: "Python" })).body.job;
await POST("/api/applications", { candidateId: cN, jobId: jobN.id });
const eN = await evaluate(cN);
const uN = (eN.body.unlockedNow ?? [])[0];
check("a new unlock is reported", Boolean(uN), eN.body.unlockedNow);
check("  has code (string)", typeof uN?.code === "string" && uN.code.length > 0, uN?.code);
check("  has title (string)", typeof uN?.title === "string" && uN.title.length > 0, uN?.title);
check("  has description (string)", typeof uN?.description === "string" && uN.description.length > 0, uN?.description);
check("  has tokenReward (positive number)", typeof uN?.tokenReward === "number" && uN.tokenReward > 0, uN?.tokenReward);
check("  has unlockedAt (timestamp)", typeof uN?.unlockedAt === "string" && !Number.isNaN(Date.parse(uN.unlockedAt)), uN?.unlockedAt);
check("  every announced unlock has all 5 fields", (eN.body.unlockedNow ?? []).every((u) =>
  ["code", "title", "description", "tokenReward", "unlockedAt"].every((k) => u[k] !== undefined && u[k] !== null)), eN.body.unlockedNow);

// A second page load must not re-announce: the server returns an empty list, so
// the banner stays quiet on reload instead of nagging the candidate forever.
const eN2 = await evaluate(cN);
check("re-evaluate announces nothing (no repeat banner)", Array.isArray(eN2.body.unlockedNow) && eN2.body.unlockedNow.length === 0, eN2.body.unlockedNow);

// ============================================================ 11. dashboard integration
step("11. Dashboard integration");
const dash = await GET(`/api/candidates/${c5}/dashboard`);
check("dashboard ok", dash.ok, dash.body);
check("dashboard includes wallet", typeof dash.body.wallet?.balance === "number", dash.body.wallet);
check("dashboard includes profile percent", typeof dash.body.profile?.percent === "number", dash.body.profile);
check("dashboard includes achievements", Array.isArray(dash.body.achievements) && dash.body.achievements.length === 6, dash.body.achievements?.length);
check("dashboard reflects the real balance", dash.body.wallet.balance === 35, dash.body.wallet);
check("dashboard name is real", dash.body.candidate?.name?.startsWith("Ach five"), dash.body.candidate?.name);
check("dashboard does not include token data in job scores", dash.body.recommendedJobs.every((j) => j.rankScore === null || typeof j.rankScore === "number"), dash.body.recommendedJobs);

const dashUnknown = await GET("/api/candidates/cand_nope/dashboard");
check("dashboard for unknown candidate -> 404", dashUnknown.status === 404, dashUnknown.body);

// Recommended jobs are all unapplied, so none can carry a real score. The UI
// must show "Apply to get AI screening score" rather than a placeholder number.
check("recommended jobs carry no fabricated score", dash.body.recommendedJobs.every((j) => j.rankScore === null), dash.body.recommendedJobs.map((j) => j.rankScore));

// The candidate pages are client components that SSR as "Loading...", so their
// real markup cannot be asserted over HTTP. Unit-test the pure label helper the
// UI actually renders instead, so this cannot pass vacuously.
const { recommendedScoreLabel, applicationScoreLabel, PENDING_SCORE_TEXT } = await import(
  "./web/lib/score-label.ts"
);
check("unscored job says 'Apply to get AI screening score'", recommendedScoreLabel(null).text === "Apply to get AI screening score", recommendedScoreLabel(null));
check("undefined score treated as pending", recommendedScoreLabel(undefined).kind === "pending", recommendedScoreLabel(undefined));
check("pending job renders no numeric placeholder", !/\d/.test(recommendedScoreLabel(null).text), recommendedScoreLabel(null).text);
check("pending job text is exactly the required copy", PENDING_SCORE_TEXT === "Apply to get AI screening score", PENDING_SCORE_TEXT);
check("real score renders formatted", recommendedScoreLabel(0.8123).text === "0.812", recommendedScoreLabel(0.8123));
check("zero is a real score, not pending", recommendedScoreLabel(0).kind === "score", recommendedScoreLabel(0));
check("unscreened application says awaiting screening", applicationScoreLabel(null).kind === "pending", applicationScoreLabel(null));
check("screened application shows score", applicationScoreLabel(0.5, 1.2).text === "0.500", applicationScoreLabel(0.5, 1.2));
check("screened application keeps multiplier", applicationScoreLabel(0.5, 1.2).multiplier === 1.2, applicationScoreLabel(0.5, 1.2));
check("missing multiplier is tolerated", applicationScoreLabel(0.5).multiplier === null, applicationScoreLabel(0.5));

// After applying + screening, the real score must be readable. c5 applied to
// jobs[0..4] and the e2e suite screens jobs, so re-screening here proves the
// value is surfaced rather than invented.
const cS = await newCandidate("score");
const jobS = (await POST("/api/jobs", { title: "Score Role", company: "Acme", requiredSkills: "Python" })).body.job;
await uploadResume(cS);
const appS = (await POST("/api/applications", { candidateId: cS, jobId: jobS.id })).body.application;
let appsS = (await GET(`/api/applications?candidateId=${cS}`)).body.applications;
check("unscreened application reports a null score", appsS[0]?.screeningRankScore === null, appsS[0]);
await POST("/api/shortlist", { jobId: jobS.id });
appsS = (await GET(`/api/applications?candidateId=${cS}`)).body.applications;
check("screened application reports a real score", typeof appsS[0]?.screeningRankScore === "number", appsS[0]);
check("screened score is in a sane range", appsS[0]?.screeningRankScore >= 0 && appsS[0]?.screeningRankScore <= 1, appsS[0]?.screeningRankScore);
check("verification multiplier is surfaced", typeof appsS[0]?.screeningMultiplier === "number", appsS[0]?.screeningMultiplier);
check("application id matches", appsS[0]?.id === appS.id, { got: appsS[0]?.id, want: appS.id });

// ============================================================ 12. pages render
step("12. Pages render");
const someAssessment = (await GET("/api/assessments")).body.assessments[0].id;
for (const p of [
  "/candidate/rewards",
  "/candidate/rewards/history",
  "/candidate/assessments",
  "/candidate",
  `/candidate/assessments/${someAssessment}`,
  `/candidate/assessments/${someAssessment}/result`,
]) {
  const r = await fetch(BASE + p);
  const t = await r.text();
  check(`GET ${p}`, r.ok, t.slice(0, 120));
  check(`  ${p} has no server error boundary`, !t.includes("Application error"), t.slice(0, 200));
}

// ============================================================ summary
console.log(`\n${"=".repeat(46)}`);
const summary = `PASS: ${pass}   FAIL: ${fail}`;
console.log(fail === 0 ? `\x1b[32m${summary}\x1b[0m` : `\x1b[31m${summary}\x1b[0m`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);

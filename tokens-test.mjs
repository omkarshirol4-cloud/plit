/**
 * Candidate Rewards / Tokens — test suite.
 *
 *   node tokens-test.mjs
 *
 * Covers wallet creation, earning, transaction records, balance updates,
 * duplicate-event prevention, daily active-session caps, and the anti-abuse
 * rule that a client cannot dictate its own payout.
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

async function newCandidate(label, skills = "Python, PostgreSQL, Kubernetes") {
  const r = await POST("/api/candidates", {
    name: `Token ${label}`,
    email: `tok-${label}-${stamp}@example.com`,
    headline: "Backend Engineer",
    skills,
  });
  return r.body.candidate.id;
}

async function uploadResume(id) {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["Alice Chen Senior Backend Engineer. Skills: Python, Go, PostgreSQL, Kubernetes, AWS, Docker."], {
      type: "text/plain",
    }),
    "resume.txt",
  );
  const res = await fetch(`${BASE}/api/candidates/${id}/resume`, { method: "POST", body: form });
  return res.json();
}

// ============================================================ 1. wallet creation
step("1. Wallet creation");
const alice = await newCandidate("alice");
check("candidate created", alice?.startsWith("cand_"), alice);

const w0 = await GET(`/api/candidates/${alice}/tokens`);
check("GET tokens creates wallet lazily", w0.ok && w0.body.wallet?.candidateId === alice, w0.body);
check("wallet id prefix", String(w0.body.wallet?.id).startsWith("wal_"), w0.body.wallet);
check("starting balance is 0", w0.body.wallet?.balance === 0, w0.body.wallet);
check("lifetimeEarned is 0", w0.body.wallet?.lifetimeEarned === 0, w0.body.wallet);
check("lifetimeSpent is 0", w0.body.wallet?.lifetimeSpent === 0, w0.body.wallet);
check("createdAt + updatedAt present", Boolean(w0.body.wallet?.createdAt && w0.body.wallet?.updatedAt), w0.body.wallet);
check("reward rules exposed", w0.body.rules?.JOB_APPLICATION?.amount === 25, w0.body.rules?.JOB_APPLICATION);
check("rules are server amounts, not client", w0.body.rules?.ACTIVE_SESSION?.amount === 2, w0.body.rules?.ACTIVE_SESSION);

const w0b = await GET(`/api/candidates/${alice}/tokens`);
check("wallet is stable across reads (not recreated)", w0b.body.wallet.id === w0.body.wallet.id, {
  first: w0.body.wallet.id,
  second: w0b.body.wallet.id,
});

const ghost = await GET("/api/candidates/cand_doesnotexist/tokens");
check("unknown candidate -> 404", ghost.status === 404, ghost.body);

// ============================================================ 2. earning
step("2. Earning tokens");
const fresh = await newCandidate("fresh");
const noResume = await POST(`/api/candidates/${fresh}/tokens/earn`, { type: "RESUME_UPLOAD" });
check("RESUME_UPLOAD blocked with no resume (409)", noResume.status === 409, noResume.body);
check("  code = NO_RESUME", noResume.body.code === "NO_RESUME", noResume.body);

await uploadResume(fresh);
const r1 = await POST(`/api/candidates/${fresh}/tokens/earn`, { type: "RESUME_UPLOAD" });
check("RESUME_UPLOAD awarded", r1.status === 201 && r1.body.awarded === true, r1.body);
check("  amount = 10 (server-set)", r1.body.transaction?.amount === 10, r1.body.transaction);
check("  type recorded", r1.body.transaction?.type === "RESUME_UPLOAD", r1.body.transaction);
check("  description recorded", typeof r1.body.transaction?.description === "string" && r1.body.transaction.description.length > 0, r1.body.transaction);
check("  transaction id prefix", String(r1.body.transaction?.id).startsWith("tok_"), r1.body.transaction?.id);
check("  createdAt recorded", Boolean(r1.body.transaction?.createdAt), r1.body.transaction);
check("  balance updated to 10", r1.body.wallet?.balance === 10, r1.body.wallet);
check("  lifetimeEarned = 10", r1.body.wallet?.lifetimeEarned === 10, r1.body.wallet);
check("  lifetimeSpent = 0", r1.body.wallet?.lifetimeSpent === 0, r1.body.wallet);

// PROFILE_COMPLETION needs headline + >=3 skills + resume
const partial = await newCandidate("partial", "Python");
const noProfile = await POST(`/api/candidates/${partial}/tokens/earn`, { type: "PROFILE_COMPLETION" });
check("PROFILE_COMPLETION blocked with <3 skills (409)", noProfile.status === 409, noProfile.body);
check("  code = PROFILE_INCOMPLETE", noProfile.body.code === "PROFILE_INCOMPLETE", noProfile.body);

await uploadResume(partial);
await req("PATCH", `/api/candidates/${partial}`, { skills: "Python, PostgreSQL, Kubernetes" });
const pc = await POST(`/api/candidates/${partial}/tokens/earn`, { type: "PROFILE_COMPLETION" });
check("PROFILE_COMPLETION awarded after resume + 3 skills", pc.status === 201 && pc.body.wallet.balance === 15, pc.body);
check("  +15 profile credit (no resume credit yet — that is a separate call)", pc.body.transaction?.amount === 15, pc.body.transaction);

// DAILY_LOGIN
const dl = await POST(`/api/candidates/${fresh}/tokens/earn`, { type: "DAILY_LOGIN" });
check("DAILY_LOGIN awarded +5", dl.status === 201 && dl.body.wallet.balance === 15, dl.body.wallet);
const dl2 = await POST(`/api/candidates/${fresh}/tokens/earn`, { type: "DAILY_LOGIN" });
check("DAILY_LOGIN capped at 1/day (429)", dl2.status === 429 && dl2.body.code === "DAILY_CAP_REACHED", dl2.body);
const wAfterDl = await GET(`/api/candidates/${fresh}/tokens`);
check("balance unchanged after capped attempt", wAfterDl.body.wallet.balance === 15, wAfterDl.body.wallet);

// ============================================================ 3. event validation (no fake rewards)
step("3. Server-side event validation");
const job = (await POST("/api/jobs", { title: "Token Test Role", company: "Acme", requiredSkills: "Python" })).body.job;
const app = (await POST("/api/applications", { candidateId: alice, jobId: job.id })).body.application;

// Same application, but no verification session recorded yet.
const fakeVerif = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "VERIFICATION_COMPLETION", referenceId: app.id });
check("VERIFICATION_COMPLETION without a session -> 409", fakeVerif.status === 409, fakeVerif.body);
check("  code = NOT_VERIFIED", fakeVerif.body.code === "NOT_VERIFIED", fakeVerif.body);

const noRef = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "VERIFICATION_COMPLETION" });
check("VERIFICATION_COMPLETION without a referenceId -> 400/409", noRef.status >= 400, noRef.body);

const fakeApp = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "JOB_APPLICATION", referenceId: "app_fake" });
check("JOB_APPLICATION with bogus reference -> 409", fakeApp.status === 409, fakeApp.body);
check("  code = NO_SUCH_APPLICATION", fakeApp.body.code === "NO_SUCH_APPLICATION", fakeApp.body);

const realApp = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "JOB_APPLICATION", referenceId: app.id });
check("JOB_APPLICATION with real application -> 201", realApp.status === 201 && realApp.body.wallet.balance === 25, realApp.body.wallet);

// flagged verification must NOT pay
const carol = await newCandidate("carol");
const carolApp = (await POST("/api/applications", { candidateId: carol, jobId: job.id })).body.application;
await POST("/api/verification-sessions", {
  submissionId: carolApp.id,
  gazeScore: 0.2,
  lipSyncScore: 0.1,
  audioScore: 0.2,
  result: "fail",
  reviewedByHR: true,
});
const failPay = await POST(`/api/candidates/${carol}/tokens/earn`, { type: "VERIFICATION_COMPLETION", referenceId: carolApp.id });
check("VERIFICATION_COMPLETION with result=fail -> 409", failPay.status === 409, failPay.body);
check("  code = VERIFICATION_NOT_PASSED", failPay.body.code === "VERIFICATION_NOT_PASSED", failPay.body);

// passed verification DOES pay
await uploadResume(alice);
await POST("/api/verification-sessions", {
  submissionId: app.id,
  gazeScore: 0.9,
  lipSyncScore: 0.9,
  audioScore: 0.9,
  result: "pass",
  reviewedByHR: false,
});
const passPay = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "VERIFICATION_COMPLETION", referenceId: app.id });
check("VERIFICATION_COMPLETION with result=pass -> 201", passPay.status === 201, passPay.body);
check("  +50 for passing verification", passPay.body.wallet.balance === 75, passPay.body.wallet);
check("  balance = 25 (application) + 50 (verification), no resume credit claimed", passPay.body.wallet.balance === 75, passPay.body.wallet);

// ============================================================ 4. client cannot dictate payout
step("4. Client cannot choose the amount");
const cheat = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "ACHIEVEMENT", amount: 100000, referenceId: "x1" });
check("POST with `amount` field rejected (400)", cheat.status === 400, cheat.body);
check("  code = AMOUNT_NOT_ACCEPTED", cheat.body.code === "AMOUNT_NOT_ACCEPTED", cheat.body);

const before = (await GET(`/api/candidates/${alice}/tokens`)).body.wallet.balance;
await POST(`/api/candidates/${alice}/tokens/earn`, { type: "ACHIEVEMENT", amount: 100000, referenceId: "x1" });
const after = (await GET(`/api/candidates/${alice}/tokens`)).body.wallet.balance;
check("balance unchanged by cheat attempt", before === after, { before, after });

const badType = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "GIVE_ME_MONEY" });
check("unknown type -> 400", badType.status === 400 && badType.body.code === "UNKNOWN_TYPE", badType.body);

const spendCheat = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "SPEND", referenceId: "y1" });
check("SPEND rejected on the earn route", spendCheat.status === 400, spendCheat.body);

// ============================================================ 5. duplicate prevention
step("5. Duplicate event prevention");
const dupApp = await POST(`/api/candidates/${alice}/tokens/earn`, { type: "JOB_APPLICATION", referenceId: app.id });
check("replay JOB_APPLICATION does not double-credit", dupApp.body.awarded === false, dupApp.body);
check("  same referenceId already recorded", dupApp.body.transaction === null, dupApp.body);
const wDup = await GET(`/api/candidates/${alice}/tokens`);
check("balance still 75 after replay", wDup.body.wallet.balance === 75, wDup.body.wallet);

const h = await GET(`/api/candidates/${alice}/tokens/history`);
const jobAppTxns = h.body.transactions.filter((t) => t.type === "JOB_APPLICATION");
check("exactly 1 JOB_APPLICATION transaction recorded", jobAppTxns.length === 1, jobAppTxns);
check("  the one stored is the real application", jobAppTxns[0]?.referenceId === app.id, jobAppTxns[0]);

// `partial` already claimed PROFILE_COMPLETION in section 2, so the lifetime
// cap of 1 must now refuse it. (`fresh` is not a valid subject here — it has
// never claimed it, so its first attempt legitimately succeeds.)
const lifetime = await POST(`/api/candidates/${partial}/tokens/earn`, { type: "PROFILE_COMPLETION" });
check("PROFILE_COMPLETION lifetime cap 1 -> 2nd is 409", lifetime.status === 409, lifetime.body);
check("  code = LIFETIME_CAP_REACHED", lifetime.body.code === "LIFETIME_CAP_REACHED", lifetime.body);
const partialAfterCap = (await GET(`/api/candidates/${partial}/tokens`)).body.wallet;
check("  no credit leaked on the capped attempt", partialAfterCap.balance === 15, partialAfterCap);

// ============================================================ 6. ACTIVE_SESSION anti-abuse
step("6. ACTIVE_SESSION anti-abuse");
const burner = await newCandidate("burner");
const s1 = await POST(`/api/candidates/${burner}/tokens/earn`, { type: "ACTIVE_SESSION" });
check("1st ACTIVE_SESSION -> 201", s1.status === 201 && s1.body.wallet.balance === 2, s1.body.wallet);

const s2 = await POST(`/api/candidates/${burner}/tokens/earn`, { type: "ACTIVE_SESSION" });
check("immediate 2nd ACTIVE_SESSION -> 429", s2.status === 429, s2.body);
check("  code = TOO_SOON (min interval enforced)", s2.body.code === "TOO_SOON", s2.body);

// Hammer it: 40 rapid calls must not produce more than 1 payout.
let awarded = 0;
for (let i = 0; i < 40; i++) {
  const r = await POST(`/api/candidates/${burner}/tokens/earn`, { type: "ACTIVE_SESSION" });
  if (r.status === 201) awarded++;
}
check("40 rapid calls yielded 0 extra payouts", awarded === 0, { awarded });
const burnerWallet = (await GET(`/api/candidates/${burner}/tokens`)).body.wallet;
check("burner balance is 2 after hammering", burnerWallet.balance === 2, burnerWallet);
check("burner has 1 ACTIVE_SESSION txn", (await GET(`/api/candidates/${burner}/tokens/history`)).body.transactions.filter((t) => t.type === "ACTIVE_SESSION").length === 1, "");

// The daily cap is 10 and the min interval is 300s, so reaching the cap
// through the API in real time would take 50 minutes. Instead, seed a fresh
// candidate with 10 distinct ACTIVE_SESSION ledger rows spread across distinct
// time buckets today. The point is to prove the CAP is enforced on ledger
// state, not just on how many times the endpoint happened to be called.
const capper = await newCandidate("capper");
const { DatabaseSync } = await import("node:sqlite");
const dayStart = new Date();
dayStart.setUTCHours(0, 0, 0, 0);
const seedDb = new DatabaseSync("web/data/hr.db");
seedDb.exec("PRAGMA foreign_keys = ON");
const now = new Date().toISOString();
seedDb.prepare("INSERT OR IGNORE INTO candidate_wallets (id, candidateId, balance, lifetimeEarned, lifetimeSpent, createdAt, updatedAt) VALUES (?, ?, 0, 0, 0, ?, ?)").run(`wal_seed_${stamp}`, capper, now, now);
const insActive = seedDb.prepare(
  "INSERT INTO token_transactions (id, candidateId, amount, type, description, referenceId, createdAt) VALUES (?, ?, 2, 'ACTIVE_SESSION', ?, ?, ?)",
);
for (let i = 0; i < 10; i++) {
  insActive.run(
    `tok_seed_${stamp}_${i}`,
    capper,
    "Active session",
    `seed-bucket-${i}`,
    new Date(dayStart.getTime() + i * 60 * 60 * 1000).toISOString(),
  );
}
seedDb.prepare("UPDATE candidate_wallets SET balance = 20, lifetimeEarned = 20, updatedAt = ? WHERE candidateId = ?").run(now, capper);
seedDb.close();

const capTest = await POST(`/api/candidates/${capper}/tokens/earn`, { type: "ACTIVE_SESSION" });
check("11th ACTIVE_SESSION blocked once 10/day cap met (429)", capTest.status === 429, capTest.body);
check("  code = DAILY_CAP_REACHED", capTest.body.code === "DAILY_CAP_REACHED", capTest.body);

const capWallet = (await GET(`/api/candidates/${capper}/tokens`)).body.wallet;
check("balance reflects 10 buckets x 2 = 20", capWallet.balance === 20, capWallet);
check("burner hit the daily ceiling, not unbounded", capWallet.balance <= 20, capWallet);

// ============================================================ 7. spending
step("7. Spending");
const poor = await newCandidate("poor");
const sp1 = await POST(`/api/candidates/${poor}/tokens/spend`, { cost: 10, description: "Priority listing" });
check("spend without balance -> 409", sp1.status === 409 && sp1.body.code === "INSUFFICIENT_TOKENS", sp1.body);

await uploadResume(poor);
await POST(`/api/candidates/${poor}/tokens/earn`, { type: "RESUME_UPLOAD" });
const sp2 = await POST(`/api/candidates/${poor}/tokens/spend`, { cost: 7, description: "Boost profile", referenceId: "boost-1" });
check("spend debits balance", sp2.status === 201 && sp2.body.wallet.balance === 3, sp2.body.wallet);
check("  lifetimeEarned stays 10", sp2.body.wallet.lifetimeEarned === 10, sp2.body.wallet);
check("  lifetimeSpent = 7", sp2.body.wallet.lifetimeSpent === 7, sp2.body.wallet);

const spDup = await POST(`/api/candidates/${poor}/tokens/spend`, { cost: 7, description: "Boost profile", referenceId: "boost-1" });
check("duplicate spend ref does not double-debit", spDup.body.awarded === false, spDup.body);
check("  duplicate reports no-op, not an error", spDup.ok === true, { status: spDup.status, body: spDup.body });
check("  duplicate carries no new transaction", spDup.body.transaction === null, spDup.body);
const poorWallet = (await GET(`/api/candidates/${poor}/tokens`)).body.wallet;
check("balance still 3 after duplicate spend", poorWallet.balance === 3, poorWallet);

const badCost = await POST(`/api/candidates/${poor}/tokens/spend`, { cost: -5, description: "negative" });
check("negative cost rejected (400)", badCost.status === 400, badCost.body);
const hugeCost = await POST(`/api/candidates/${poor}/tokens/spend`, { cost: 99999999, description: "huge" });
check("absurd cost rejected (400)", hugeCost.status === 400, hugeCost.body);

// ============================================================ 8. history + leaderboard
step("8. History and leaderboard");
const hist = await GET(`/api/candidates/${alice}/tokens/history?limit=10`);
check("history returns transactions", hist.ok && Array.isArray(hist.body.transactions), hist.body);
check("history reports total", typeof hist.body.total === "number" && hist.body.total > 0, hist.body.total);
check("history newest first", hist.body.transactions[0].createdAt >= hist.body.transactions[hist.body.transactions.length - 1].createdAt, hist.body.transactions.map((t) => t.createdAt));
check("limit respected", hist.body.transactions.length <= 10, hist.body.transactions.length);
check("every row has required fields", hist.body.transactions.every((t) => t.id && t.candidateId && typeof t.amount === "number" && t.type && t.description !== undefined && t.referenceId !== undefined && t.createdAt), hist.body.transactions[0]);

const p1 = await GET(`/api/candidates/${alice}/tokens/history?limit=1&offset=0`);
const p2 = await GET(`/api/candidates/${alice}/tokens/history?limit=1&offset=1`);
check("pagination page 1 has 1 row", p1.body.transactions.length === 1, p1.body.transactions);
check("pagination page 2 has 1 row", p2.body.transactions.length === 1, p2.body.transactions);
check("pagination returns different rows per page", p1.body.transactions[0]?.id !== p2.body.transactions[0]?.id, {
  page1: p1.body.transactions[0]?.id,
  page2: p2.body.transactions[0]?.id,
});
const beyond = await GET(`/api/candidates/${alice}/tokens/history?limit=5&offset=999`);
check("offset past the end returns empty page", beyond.ok && beyond.body.transactions.length === 0, beyond.body);

const emptyHist = await GET(`/api/candidates/${poor}/tokens/history`);
check("history is non-empty after activity", emptyHist.body.total >= 2, emptyHist.body.total);

const lb = await GET("/api/tokens/leaderboard?limit=5");
check("leaderboard returns ranked rows", lb.ok && Array.isArray(lb.body.leaderboard), lb.body);
check("leaderboard sorted by balance desc", lb.body.leaderboard.every((r, i, a) => i === 0 || a[i - 1].balance >= r.balance), lb.body.leaderboard);
check("leaderboard ranks from 1", lb.body.leaderboard[0]?.rank === 1, lb.body.leaderboard[0]);
check("leaderboard limit respected", lb.body.leaderboard.length <= 5, lb.body.leaderboard.length);

const hist404 = await GET("/api/candidates/cand_nope/tokens/history");
check("history unknown candidate -> 404", hist404.status === 404, hist404.body);

// ============================================================ 9. durability
step("9. Durability across connections");
const finalAlice = (await GET(`/api/candidates/${alice}/tokens`)).body.wallet;
check("alice final balance is 75", finalAlice.balance === 75, finalAlice);
check("lifetimeEarned 75, lifetimeSpent 0", finalAlice.lifetimeEarned === 75 && finalAlice.lifetimeSpent === 0, finalAlice);
const sumCheck = finalAlice.balance === finalAlice.lifetimeEarned - finalAlice.lifetimeSpent;
check("balance === earned - spent (invariant)", sumCheck, finalAlice);

// ============================================================ summary
console.log(`\n${"=".repeat(46)}`);
const summary = `PASS: ${pass}   FAIL: ${fail}`;
console.log(fail === 0 ? `\x1b[32m${summary}\x1b[0m` : `\x1b[31m${summary}\x1b[0m`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);

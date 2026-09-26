/**
 * Assessments — test suite.
 *
 *   node assessments-test.mjs
 *
 * Focus is the reward-integrity properties, not the UI: the server decides the
 * score, the server decides the payout, and neither can be replayed or forged.
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
    name: `Asm ${label}`,
    email: `asm-${label}-${stamp}@example.com`,
    headline: "Backend Engineer",
    skills: "Python, PostgreSQL, Kubernetes",
  });
  return r.body.candidate.id;
}

async function uploadResume(id) {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["Asm Probe. Senior Backend Engineer. Skills: Python, Go, PostgreSQL, Kubernetes, AWS, Docker."], {
      type: "text/plain",
    }),
    "resume.txt",
  );
  await fetch(`${BASE}/api/candidates/${id}/resume`, { method: "POST", body: form });
}

const walletOf = async (id) => (await GET(`/api/candidates/${id}/tokens`)).body.wallet;
const allAnswers = (n, pick = () => 0) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i + 1}`, pick(i)]));

// ============================================================ 1. catalogue
step("1. Assessment catalogue");
const list = await GET("/api/assessments");
check("GET /api/assessments ok", list.ok, list.body);
check("at least 2 assessments seeded", list.body.assessments?.length >= 2, list.body.assessments?.length);

const titles = list.body.assessments.map((a) => a.title);
check("Psychology Fundamentals present", titles.includes("Psychology Fundamentals"), titles);
check("Workplace Skills present", titles.includes("Workplace Skills"), titles);

const first = list.body.assessments[0];
check("assessment has a tokenReward", Number.isInteger(first.tokenReward) && first.tokenReward > 0, first.tokenReward);
check("assessment has questions", first.questions.length >= 5, first.questions?.length);
check("questionCount matches questions length", first.questionCount === first.questions.length, {
  questionCount: first.questionCount,
  actual: first.questions?.length,
});
check("every question has >=2 options", first.questions.every((q) => Array.isArray(q.options) && q.options.length >= 2), first.questions[0]);
check("all assessments are active", list.body.assessments.every((a) => a.active === true), list.body.assessments.map((a) => a.active));

const one = await GET(`/api/assessments/${first.id}`);
check("GET single assessment ok", one.ok, one.body);
check("unknown assessment -> 404", (await GET("/api/assessments/asm_nope")).status === 404, "expected 404");

// ============================================================ 2. answer key must not leak
step("2. Answer key never reaches the client");
const rawList = await fetch(`${BASE}/api/assessments`).then((r) => r.text());
check("raw list JSON contains no answerIndex", !rawList.includes("answerIndex"), "LEAKED answerIndex");
const rawOne = await fetch(`${BASE}/api/assessments/${first.id}`).then((r) => r.text());
check("raw detail JSON contains no answerIndex", !rawOne.includes("answerIndex"), "LEAKED answerIndex");

const q0 = first.questions[0];
check("question keys are exactly id/prompt/options", Object.keys(q0).sort().join(",") === "id,options,prompt", Object.keys(q0));

const resultProbe = await GET(`/api/assessments/${first.id}/result?candidateId=cand_nope`);
check("result for unknown candidate -> 404", resultProbe.status === 404, resultProbe.body);

// ============================================================ 3. start / submit
step("3. Start and submit");
const c1 = await newCandidate("happy");
const start = await POST(`/api/assessments/${first.id}/start`, { candidateId: c1 });
check("start -> 201", start.status === 201, start.body);
check("attempt id prefix", String(start.body.attempt?.id).startsWith("att_"), start.body.attempt?.id);
check("attempt starts incomplete", start.body.attempt?.completed === false, start.body.attempt);
check("resumed flag false on first start", start.body.resumed === false, start.body);

const startAgain = await POST(`/api/assessments/${first.id}/start`, { candidateId: c1 });
check("second start resumes the same attempt", startAgain.body.attempt?.id === start.body.attempt?.id, {
  first: start.body.attempt?.id,
  second: startAgain.body.attempt?.id,
});
check("resumed flag true on repeat", startAgain.body.resumed === true, startAgain.body);

const submitNoStart = await POST(`/api/assessments/${list.body.assessments[1].id}/submit`, {
  candidateId: c1,
  answers: allAnswers(10),
});
check("submit without start -> 409", submitNoStart.status === 409, submitNoStart.body);
check("  code = ATTEMPT_NOT_STARTED", submitNoStart.body.code === "ATTEMPT_NOT_STARTED", submitNoStart.body);

// Answer the first assessment with a known-wrong pattern; we only care that the
// server computed a score and paid the configured reward.
await POST(`/api/assessments/${first.id}/start`, { candidateId: c1 });
const sub = await POST(`/api/assessments/${first.id}/submit`, { candidateId: c1, answers: allAnswers(10, () => 3) });
check("submit -> 200", sub.ok, sub.body);
check("score is a number 0..100", typeof sub.body.score === "number" && sub.body.score >= 0 && sub.body.score <= 100, sub.body.score);
check("correctCount + totalCount reported", Number.isInteger(sub.body.correctCount) && sub.body.totalCount === first.questions.length, {
  correct: sub.body.correctCount,
  total: sub.body.totalCount,
});
check("attempt marked completed", sub.body.attempt?.completed === true, sub.body.attempt);
check("completedAt set", Boolean(sub.body.attempt?.completedAt), sub.body.attempt);
check("review returned per question", sub.body.review?.length === first.questions.length, sub.body.review?.length);

const w1 = await walletOf(c1);
check("reward awarded", sub.body.reward?.awarded === true, sub.body.reward);
check("reward amount = assessment.tokenReward (server-set)", sub.body.reward?.amount === first.tokenReward, {
  reward: sub.body.reward?.amount,
  configured: first.tokenReward,
});
// The first assessment a candidate finishes also unlocks FIRST_ASSESSMENT, so
// the wallet legitimately holds more than the assessment reward alone. Read the
// achievement's configured amount rather than hardcoding it.
const firstAssessmentAch = (await GET(`/api/candidates/${c1}/achievements`)).body.achievements.find(
  (a) => a.code === "FIRST_ASSESSMENT",
);
const expectedBalance = first.tokenReward + firstAssessmentAch.tokenReward;
check("FIRST_ASSESSMENT unlocked by the first completion", firstAssessmentAch.unlocked === true, firstAssessmentAch);
check("balance = assessment reward + FIRST_ASSESSMENT", w1.balance === expectedBalance, {
  balance: w1.balance,
  assessment: first.tokenReward,
  achievement: firstAssessmentAch.tokenReward,
});
check("lifetimeEarned matches balance", w1.lifetimeEarned === expectedBalance, w1);

const txns = (await GET(`/api/candidates/${c1}/tokens/history`)).body.transactions;
const asmTxn = txns.find((t) => t.type === "ASSESSMENT_COMPLETION");
check("ASSESSMENT_COMPLETION transaction recorded", Boolean(asmTxn), txns.map((t) => t.type));
check("  transaction amount is the assessment reward", asmTxn?.amount === first.tokenReward, asmTxn);
check("  transaction referenceId is the attempt id", asmTxn?.referenceId === sub.body.attempt?.id, asmTxn);

// ============================================================ 4. perfect score is computed, not sent
step("4. Score is server-computed");
const c2 = await newCandidate("perfect");
const second = list.body.assessments[1];
await POST(`/api/assessments/${second.id}/start`, { candidateId: c2 });
const empty = await POST(`/api/assessments/${second.id}/submit`, { candidateId: c2, answers: {} });
check("empty answers still completes the attempt", empty.body.attempt?.completed === true, empty.body.attempt);
check("empty answers score is 0", empty.body.score === 0, empty.body.score);
check("empty answers still earns the completion reward", empty.body.reward?.awarded === true, empty.body.reward);
check("reward is paid for completion, not for score", empty.body.reward?.amount === second.tokenReward, empty.body.reward);

// ============================================================ 5. no duplicate rewards
step("5. Duplicate completion is blocked");
const c3 = await newCandidate("dupe");
const third = list.body.assessments[2] ?? list.body.assessments[0];
await POST(`/api/assessments/${third.id}/start`, { candidateId: c3 });
const s1 = await POST(`/api/assessments/${third.id}/submit`, { candidateId: c3, answers: allAnswers(10) });
check("first submit awards", s1.body.reward?.awarded === true, s1.body.reward);
const balAfterFirst = (await walletOf(c3)).balance;

const s2 = await POST(`/api/assessments/${third.id}/submit`, { candidateId: c3, answers: allAnswers(10, (i) => (i + 1) % 4) });
check("replayed submit does not award again", s2.body.reward?.awarded === false, s2.body.reward);
check("  balance unchanged after replay", (await walletOf(c3)).balance === balAfterFirst, {
  before: balAfterFirst,
  after: (await walletOf(c3)).balance,
});
const dupeTxns = (await GET(`/api/candidates/${c3}/tokens/history`)).body.transactions.filter((t) => t.type === "ASSESSMENT_COMPLETION");
check("exactly one ASSESSMENT_COMPLETION row", dupeTxns.length === 1, dupeTxns);

// 20 parallel submits: the UNIQUE(candidateId, assessmentId) on attempts plus the
// ledger's unique index must mean exactly one payout.
const c4 = await newCandidate("race");
await POST(`/api/assessments/${first.id}/start`, { candidateId: c4 });
const parallel = await Promise.all(
  Array.from({ length: 20 }, () => POST(`/api/assessments/${first.id}/submit`, { candidateId: c4, answers: allAnswers(10) })),
);
const awardedCount = parallel.filter((r) => r.body.reward?.awarded === true).length;
check("20 parallel submits award exactly once", awardedCount === 1, { awardedCount });
const raceTxns = (await GET(`/api/candidates/${c4}/tokens/history`)).body.transactions.filter((t) => t.type === "ASSESSMENT_COMPLETION");
check("  exactly one ledger row after the race", raceTxns.length === 1, raceTxns.length);

// ============================================================ 6. client cannot dictate the reward
step("6. Client cannot dictate reward or score");
const c5 = await newCandidate("cheat");
const cheatAsm = list.body.assessments[0];
await POST(`/api/assessments/${cheatAsm.id}/start`, { candidateId: c5 });

for (const field of ["amount", "tokenReward", "score", "wallet", "balance"]) {
  const r = await POST(`/api/assessments/${cheatAsm.id}/submit`, {
    candidateId: c5,
    answers: allAnswers(10),
    [field]: field === "score" ? 100 : 999999,
  });
  check(`submit with \`${field}\` rejected (400)`, r.status === 400, r.body);
  check(`  code = CLIENT_VALUE_REJECTED`, r.body.code === "CLIENT_VALUE_REJECTED", r.body);
}
check("balance untouched by every cheat attempt", (await walletOf(c5)).balance === 0, await walletOf(c5));

const stillOpen = await GET(`/api/candidates/${c5}/assessments`);
check("cheat attempts did not complete the attempt", stillOpen.body.attempts?.[0]?.completed === false, stillOpen.body.attempts?.[0]);

// A well-formed submission still works afterwards, proving the rejections were
// refusals rather than a broken endpoint.
const realSubmit = await POST(`/api/assessments/${cheatAsm.id}/submit`, { candidateId: c5, answers: allAnswers(10) });
check("honest submit still works after cheat attempts", realSubmit.body.reward?.awarded === true, realSubmit.body.reward);
// Same for c5: its first assessment also earns FIRST_ASSESSMENT.
const cheatAch = (await GET(`/api/candidates/${c5}/achievements`)).body.achievements.find((a) => a.code === "FIRST_ASSESSMENT");
const cheatExpected = cheatAsm.tokenReward + cheatAch.tokenReward;
check("  paid assessment reward + FIRST_ASSESSMENT", (await walletOf(c5)).balance === cheatExpected, {
  balance: (await walletOf(c5)).balance,
  expected: cheatExpected,
});

// ============================================================ 7. bad input
step("7. Input validation");
check("submit without candidateId -> 400", (await POST(`/api/assessments/${first.id}/submit`, { answers: {} })).status === 400, "expected 400");
const badAnswers = await POST(`/api/assessments/${first.id}/submit`, { candidateId: c5, answers: "not-an-object" });
check("answers as a string -> 400", badAnswers.status === 400, badAnswers.body);
const unknownCand = await POST(`/api/assessments/${first.id}/start`, { candidateId: "cand_nope" });
check("start for unknown candidate -> 404", unknownCand.status === 404, unknownCand.body);
const unknownAsmStart = await POST("/api/assessments/asm_nope/start", { candidateId: c5 });
check("start unknown assessment -> 404", unknownAsmStart.status === 404, unknownAsmStart.body);

// Out-of-range option indexes are ignored rather than counted as correct.
const c6 = await newCandidate("range");
const rangeAsm = list.body.assessments[1];
await POST(`/api/assessments/${rangeAsm.id}/start`, { candidateId: c6 });
const oor = await POST(`/api/assessments/${rangeAsm.id}/submit`, { candidateId: c6, answers: allAnswers(10, () => 999) });
check("out-of-range options -> score 0, not an error", oor.body.score === 0, oor.body.score);
check("out-of-range options still complete", oor.body.attempt?.completed === true, oor.body.attempt);

// ============================================================ 8. result endpoint
step("8. Result endpoint");
const result = await GET(`/api/assessments/${first.id}/result?candidateId=${c1}`);
check("result ok", result.ok, result.body);
check("result has the attempt", result.body.attempt?.completed === true, result.body.attempt);
check("result has the assessment", result.body.assessment?.id === first.id, result.body.assessment?.id);
check("result assessment carries no answer key", !JSON.stringify(result.body).includes("answerIndex"), "LEAKED answerIndex");
check("result without candidateId -> 400", (await GET(`/api/assessments/${first.id}/result`)).status === 400, "expected 400");
check("result for a candidate with no attempt -> 404", (await GET(`/api/assessments/${first.id}/result?candidateId=cand_nope`)).status === 404, "expected 404");

// ============================================================ 9. pages render
step("9. Pages render");
for (const p of ["/candidate/assessments", `/candidate/assessments/${first.id}`, `/candidate/assessments/${first.id}/result`]) {
  const r = await fetch(BASE + p);
  check(`GET ${p}`, r.ok, await r.text().then((t) => t.slice(0, 120)));
}

// ============================================================ 10. token rule alignment
step("10. Direct earn endpoint cannot be abused");
const c7 = await newCandidate("direct");
await uploadResume(c7);
const fakeAttempt = await POST(`/api/candidates/${c7}/tokens/earn`, {
  type: "ASSESSMENT_COMPLETION",
  referenceId: "att_fake",
});
check("earn ASSESSMENT_COMPLETION with a fake attempt -> 409", fakeAttempt.status === 409, fakeAttempt.body);
check("  code = NO_SUCH_ATTEMPT", fakeAttempt.body.code === "NO_SUCH_ATTEMPT", fakeAttempt.body);
check("  no tokens granted", (await walletOf(c7)).balance === 0, await walletOf(c7));

const noRef = await POST(`/api/candidates/${c7}/tokens/earn`, { type: "ASSESSMENT_COMPLETION" });
check("earn ASSESSMENT_COMPLETION with no reference -> 400/409", noRef.status >= 400, noRef.body);

// ============================================================ summary
console.log(`\n${"=".repeat(46)}`);
const summary = `PASS: ${pass}   FAIL: ${fail}`;
console.log(fail === 0 ? `\x1b[32m${summary}\x1b[0m` : `\x1b[31m${summary}\x1b[0m`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);

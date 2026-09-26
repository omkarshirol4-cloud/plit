/**
 * End-to-end test of the whole MVP flow against a running stack.
 *
 *   node e2e-test.mjs
 *
 * Expects Next.js on :3000, resume screening on :8002, verification on :8001.
 * Uses native fetch/FormData so multipart uploads go out exactly the way the
 * browser sends them.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  const res = await fetch(url.startsWith("http") ? url : BASE + url, {
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

async function upload(url, field, filename, bytes, type) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), filename);
  const res = await fetch(BASE + url, { method: "POST", body: form });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, ok: res.ok, body: json };
}

// ------------------------------------------------------------------ fixtures
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hr-e2e-"));
const RESUMES = {
  alice:
    "Alice Chen - Senior Backend Engineer. 8 years distributed systems. Skills: Python, Go, PostgreSQL, Kubernetes, AWS, Docker, Terraform. Built event-driven payment services handling 40k requests per second. Designed CI/CD pipelines with automated testing and staged rollouts.",
  bob: "Bob Martinez - Frontend Engineer. 6 years of UI work. Skills: React, TypeScript, Next.js, Node.js, CSS. Shipped design systems and accessibility improvements to a checkout flow.",
  carol:
    "Carol Singh - Data Scientist. Skills: Python, machine learning, TensorFlow, PyTorch, SQL, pandas. Built recommendation models and A/B testing infrastructure.",
};

const stamp = Date.now();
const emails = {
  alice: `alice+${stamp}@example.com`,
  bob: `bob+${stamp}@example.com`,
  carol: `carol+${stamp}@example.com`,
};

// ------------------------------------------------------------------ 1. candidates
step("1. Candidate signup");
const mk = async (key, name, headline, skills) => {
  const r = await POST("/api/candidates", { name, email: emails[key], headline, skills });
  return r;
};
const ra = await mk("alice", "Alice Chen", "Senior Backend Engineer", "Python, PostgreSQL, Kubernetes");
const alice = ra.body?.candidate?.id;
check("create Alice", ra.status === 201 && alice?.startsWith("cand_"), ra.body);

const rb = await mk("bob", "Bob Martinez", "Frontend Engineer", "React, TypeScript");
const bob = rb.body?.candidate?.id;
check("create Bob", rb.status === 201 && bob?.startsWith("cand_"), rb.body);

const rc = await mk("carol", "Carol Singh", "Data Scientist", "Python, TensorFlow");
const carol = rc.body?.candidate?.id;
check("create Carol", rc.status === 201 && carol?.startsWith("cand_"), rc.body);

const dup = await POST("/api/candidates", { name: "Alice Again", email: emails.alice });
check("duplicate email rejected (409)", dup.status === 409, dup.body);

const noEmail = await POST("/api/candidates", { name: "No Email" });
check("missing email rejected (400)", noEmail.status === 400, noEmail.body);

const patch = await fetch(`${BASE}/api/candidates/${alice}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ headline: "Staff Backend Engineer", skills: "Python, Go, PostgreSQL" }),
});
const patched = await patch.json();
check("PATCH profile", patch.ok && patched.candidate.headline === "Staff Backend Engineer", patched);

// ------------------------------------------------------------------ 2. resume upload
step("2. Resume upload (ML :8002 /extract)");
for (const [key, id] of [["alice", alice], ["bob", bob], ["carol", carol]]) {
  const r = await upload(`/api/candidates/${id}/resume`, "file", `${key}.txt`, RESUMES[key], "text/plain");
  check(`upload ${key} (${r.body?.characters} chars)`, r.ok && r.body.characters > 50, r.body);
}
const prof = await GET(`/api/candidates/${alice}`);
check("resumeText persisted to db", (prof.body?.candidate?.resumeText?.length ?? 0) > 50, prof.body?.candidate?.resumeName);
check("PATCH'd headline persisted", prof.body?.candidate?.headline === "Staff Backend Engineer", prof.body?.candidate?.headline);

const badType = await upload(`/api/candidates/${alice}/resume`, "file", "resume.exe", Buffer.from("MZ not a resume"), "application/octet-stream");
check("unsupported file type rejected (415)", badType.status === 415, badType.body);

const noFile = await upload(`/api/candidates/${alice}/resume`, "notafile", "x.txt", "x", "text/plain");
check("missing file field rejected (400)", noFile.status === 400, noFile.body);

// ------------------------------------------------------------------ 3. job
step("3. Recruiter creates job");
const rj = await POST("/api/jobs", {
  title: "Senior Backend Engineer",
  company: "Acme",
  location: "Remote",
  description: "Build distributed services.",
  requiredSkills: "Python, PostgreSQL, Kubernetes, AWS, Docker, CI/CD",
});
const job = rj.body?.job?.id;
check("create job", rj.status === 201 && job?.startsWith("job_"), rj.body);
check("6 required skills stored", rj.body?.job?.requiredSkills?.length === 6, rj.body?.job?.requiredSkills);

const noSkills = await POST("/api/jobs", { title: "X", company: "Y" });
check("job without required skills rejected (400)", noSkills.status === 400, noSkills.body);

const jobDetail = await GET(`/api/jobs/${job}`);
check("GET job detail", jobDetail.ok && jobDetail.body?.applicantCount === 0, jobDetail.body);

// ------------------------------------------------------------------ 4. apply
step("4. Candidates apply");
const appA = (await POST("/api/applications", { candidateId: alice, jobId: job, note: "6 yrs backend" })).body?.application;
const appB = (await POST("/api/applications", { candidateId: bob, jobId: job })).body?.application;
const appC = (await POST("/api/applications", { candidateId: carol, jobId: job })).body?.application;
check("Alice applied", appA?.id?.startsWith("app_"), appA);
check("Bob applied", appB?.id?.startsWith("app_"), appB);
check("Carol applied", appC?.id?.startsWith("app_"), appC);

const reapply = await POST("/api/applications", { candidateId: alice, jobId: job });
check("re-apply rejected (409)", reapply.status === 409, reapply.body);

const noResumeApply = (await POST("/api/applications", { candidateId: (await POST("/api/candidates", { name: "No Resume", email: `nr+${stamp}@example.com` })).body.candidate.id, jobId: job })).body;
check("apply without resume warns but succeeds", noResumeApply?.application?.id?.startsWith("app_"), noResumeApply);

const myApps = await GET(`/api/applications?candidateId=${alice}`);
check("list applications by candidate", myApps.body?.applications?.length === 1, myApps.body?.applications?.length);

// ------------------------------------------------------------------ 5. shortlist
step("5. Recruiter triggers shortlist (ML :8002)");
const sl = await POST("/api/shortlist", { jobId: job });
check("shortlist ok", sl.ok, sl.body);
const results = sl.body?.results ?? [];
console.log(
  "    ranking: " + results.map((r) => `${r.rank}.${r.name}(${r.resumeScore.toFixed(3)})`).join("  "),
);
check("4 applicants ranked (incl. the no-resume one)", results.length === 4, results.length);
const byName = Object.fromEntries(results.map((r) => [r.name, r]));
check("Alice #1", results[0]?.name === "Alice Chen", results[0]);
check("Bob ranks below Carol", results.findIndex((r) => r.name === "Carol Singh") < results.findIndex((r) => r.name === "Bob Martinez"), results.map((r) => r.name));
check("Alice matched all 6 skills", byName["Alice Chen"]?.matchedSkills?.length === 6, byName["Alice Chen"]?.matchedSkills);
check("Bob matched 0 skills", byName["Bob Martinez"]?.matchedSkills?.length === 0, byName["Bob Martinez"]?.matchedSkills);
check("Alice has no missing skills", byName["Alice Chen"]?.missingSkills?.length === 0, byName["Alice Chen"]?.missingSkills);

const badJob = await POST("/api/shortlist", { jobId: "job_nope" });
check("shortlist unknown job (404)", badJob.status === 404, badJob.body);

// ------------------------------------------------------------------ 6. ranked read
step("6. Recruiter reads ranked list");
const ranked = await GET(`/api/jobs/${job}/shortlist`);
check("ranked list returned", ranked.ok && ranked.body.ranked.length === 4, ranked.body?.ranked?.length);
check("nothing unranked", ranked.body?.notYetRanked?.length === 0, ranked.body?.notYetRanked);
const ra0 = ranked.body.ranked.find((r) => r.name === "Alice Chen");
check("Alice unverified pre-check", ra0?.verification?.result === null, ra0?.verification);
check("multiplier 1.0 pre-check", ra0?.verificationMultiplier === 1.0, ra0?.verificationMultiplier);
check("hasResume surfaced", ra0?.hasResume === true, ra0);

// ------------------------------------------------------------------ 7. verification sessions
step("7. Verification results stored (ML contract shape)");
const vsA = await POST("/api/verification-sessions", {
  submissionId: appA.id,
  gazeScore: 0.93,
  lipSyncScore: 0.88,
  audioScore: 0.95,
  result: "pass",
  reviewedByHR: false,
  _fusedScore: 0.917,
  _reasons: ["all signals consistent with honest, unassisted work"],
});
check("Alice session created (pass)", vsA.status === 201 && vsA.body?.result === "pass", vsA.body);

const vsC = await POST("/api/verification-sessions", {
  submissionId: appC.id,
  gazeScore: 0.31,
  lipSyncScore: 0.18,
  audioScore: 0.44,
  result: "fail",
  reviewedByHR: true,
  _fusedScore: 0.3,
  _reasons: ["mouth movement doesn't track with detected speech"],
});
check("Carol session created (fail)", vsC.status === 201 && vsC.body?.result === "fail", vsC.body);

const dupVs = await POST("/api/verification-sessions", {
  submissionId: appA.id,
  gazeScore: 0.9,
  lipSyncScore: 0.9,
  audioScore: 0.9,
  result: "pass",
});
check("duplicate session rejected (409)", dupVs.status === 409, dupVs.body);

const badSub = await POST("/api/verification-sessions", { submissionId: "app_nope", result: "pass" });
check("unknown submissionId rejected (404)", badSub.status === 404, badSub.body);

const badResult = await POST("/api/verification-sessions", { submissionId: appB.id, result: "banished" });
check("invalid result value rejected (400)", badResult.status === 400, badResult.body);

const one = await GET(`/api/verification-sessions/${appA.id}`);
check("GET session by application", one.body?.verified === true && one.body?.session?.gazeScore === 0.93, one.body);

const none = await GET(`/api/verification-sessions/${appB.id}`);
check("GET session returns verified:false when absent", none.body?.verified === false, none.body);

// ------------------------------------------------------------------ 8. re-rank
step("8. Re-run shortlist applies verification multiplier");
const sl2 = await POST("/api/shortlist", { jobId: job });
for (const r of sl2.body.results) {
  console.log(
    `    #${r.rank} ${r.name.padEnd(14)} resume=${r.resumeScore.toFixed(3)} x${r.verificationMultiplier} ` +
      `rank=${r.rankScore.toFixed(3)} verify=${r.verificationResult ?? "none"}`,
  );
}
const b2 = Object.fromEntries((sl2.body.results ?? []).map((r) => [r.name, r]));
check("Alice gets 1.2x", b2["Alice Chen"]?.verificationMultiplier === 1.2, b2["Alice Chen"]);
check("Carol gets 0.5x", b2["Carol Singh"]?.verificationMultiplier === 0.5, b2["Carol Singh"]);
check("Bob unverified stays 1.0x", b2["Bob Martinez"]?.verificationMultiplier === 1.0, b2["Bob Martinez"]);
check("Alice still #1", sl2.body.results[0]?.name === "Alice Chen", sl2.body.results[0]);
check(
  "rank ordering is monotonic",
  sl2.body.results.every((r, i, a) => i === 0 || a[i - 1].rankScore >= r.rankScore),
  sl2.body.results.map((r) => r.rankScore),
);

// ------------------------------------------------------------------ 9. recruiter breakdown
step("9. Recruiter sees badge + signal breakdown");
const ranked2 = await GET(`/api/jobs/${job}/shortlist`);
const A = ranked2.body.ranked.find((r) => r.name === "Alice Chen");
const C = ranked2.body.ranked.find((r) => r.name === "Carol Singh");
const B = ranked2.body.ranked.find((r) => r.name === "Bob Martinez");
check("Alice badge=pass", A?.verification?.result === "pass", A?.verification);
check("Alice gaze 0.93", A?.verification?.gazeScore === 0.93, A?.verification);
check("Alice lipsync 0.88", A?.verification?.lipSyncScore === 0.88, A?.verification);
check("Alice audio 0.95", A?.verification?.audioScore === 0.95, A?.verification);
check("Alice fused 0.917", A?.verification?.fusedScore === 0.917, A?.verification);
check("Alice reviewedByHR false", A?.verification?.reviewedByHR === false, A?.verification);
check("Alice reasons present", A?.verification?.reasons?.length === 1, A?.verification?.reasons);
check("Carol badge=fail", C?.verification?.result === "fail", C?.verification);
check("Carol reviewedByHR true", C?.verification?.reviewedByHR === true, C?.verification);
check("Bob unverified", B?.verification?.result === null, B?.verification);
check("candidateId surfaced", A?.candidateId === alice, A?.candidateId);

// ------------------------------------------------------------------ 10. live clip -> :8001
step("10. Live clip through verification service :8001");
const clipPath = path.join(tmp, "clip.mp4");
const made = await (async () => {
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f", "lavfi", "-i", "testsrc=size=640x480:rate=15:duration=4",
        "-f", "lavfi", "-i", "sine=frequency=180:duration=4",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
        clipPath,
      ],
      { stdio: "ignore" },
    );
    return fs.existsSync(clipPath);
  } catch (e) {
    console.log(dim(`    ffmpeg unavailable: ${e.message}`));
    return false;
  }
})();

if (made) {
  console.log(dim(`    test clip: ${fs.statSync(clipPath).size} bytes`));
  const vr = await upload(`/api/applications/${appB.id}/verify`, "clip", "clip.mp4", fs.readFileSync(clipPath), "video/mp4");
  check("ML :8001 returned a session for Bob", vr.ok && ["pass", "flagged", "fail"].includes(vr.body?.session?.result), vr.body);
  if (vr.body?.session) {
    const s = vr.body.session;
    console.log(
      `    result=${s.result} gaze=${s.gazeScore} lipsync=${s.lipSyncScore} audio=${s.audioScore} fused=${s.fusedScore}`,
    );
    console.log(dim(`    reasons: ${JSON.stringify(s.reasons)}`));
    console.log(dim(`    diagnostics: ${JSON.stringify(vr.body.diagnostics)}`));
    check("gaze score is a number", typeof s.gazeScore === "number", s);
    check("session persisted (vs_ id)", String(s.id).startsWith("vs_"), s.id);
    check("fused score backfilled from ML", typeof s.fusedScore === "number" && s.fusedScore > 0, s.fusedScore);
    check("reasons backfilled from ML", Array.isArray(s.reasons) && s.reasons.length > 0, s.reasons);
    const reread = await GET(`/api/verification-sessions/${appB.id}`);
    check("Bob's session readable back from db", reread.body?.verified === true, reread.body);
    check("fused score persisted (not just echoed)", typeof reread.body?.session?.fusedScore === "number", reread.body?.session);

    const again = await upload(`/api/applications/${appB.id}/verify`, "clip", "clip.mp4", fs.readFileSync(clipPath), "video/mp4");
    check("re-verify blocked (409)", again.status === 409, again.body);
  }
} else {
  check("generated test clip with ffmpeg", false, "skipped - no ffmpeg on PATH");
}

// ------------------------------------------------------------------ 11. pages
step("11. Pages render");
for (const p of ["/", "/candidate", "/candidate/jobs", "/candidate/applications", "/recruiter/jobs", "/recruiter/jobs/new", `/recruiter/jobs/${job}`]) {
  try {
    const res = await fetch(BASE + p);
    const html = await res.text();
    check(`GET ${p}`, res.status === 200 && html.length > 500, `${res.status} len=${html.length}`);
  } catch (e) {
    check(`GET ${p}`, false, e.message);
  }
}

// ------------------------------------------------------------------ summary
console.log(`\n${"=".repeat(46)}`);
const summary = `PASS: ${pass}   FAIL: ${fail}`;
console.log(fail === 0 ? `\x1b[32m${summary}\x1b[0m` : `\x1b[31m${summary}\x1b[0m`);
console.log(dim(`job=${job}`));
console.log(dim(`alice=${alice}  appAlice=${appA.id}  appBob=${appB.id}  appCarol=${appC.id}`));
console.log("=".repeat(46));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail > 0 ? 1 : 0);

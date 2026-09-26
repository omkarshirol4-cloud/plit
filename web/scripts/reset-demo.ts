/**
 * `npm run reset:demo` — remove ONLY the synthetic demo rows.
 *
 * Selection is by the `demo_` id prefix, which no production row can carry
 * (`newId()` always emits `cand_`, `job_`, `app_`, `vs_`, `sl_`, `att_`,
 * `tok_`, `wal_`, `cach_` or `achv_`). The shared `assessments` and
 * `achievements` reference tables are never touched.
 *
 * The printed "non-demo rows deleted" line is the proof. It is a real
 * before/after subtraction over rows excluded from the demo selection, so any
 * non-zero value means a reset reached real data and the command exits 1.
 */
import { resetDemo } from "../lib/demo-seed.ts";

const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bar = "=".repeat(44);

const r = resetDemo();

if (r.candidates === 0 && r.jobs === 0) {
  console.log(cyan("NO DEMO DATA PRESENT"));
  console.log(bar);
  console.log(dim("Nothing to remove. The database holds no demo_ records."));
  process.exit(0);
}

console.log(red("DEMO DATA REMOVED"));
console.log(bar);
console.log(`Candidates:          ${r.candidates}`);
console.log(`Jobs:                ${r.jobs}`);
console.log(`Applications:        ${r.applications}`);
console.log(`Shortlist records:   ${r.shortlistResults}`);
console.log(`Verification rows:   ${r.verificationSessions}`);
console.log(`Wallets:             ${r.wallets}`);
console.log(`Token transactions:  ${r.tokenTransactions}`);
console.log(`Assessment attempts: ${r.assessmentAttempts}`);
console.log(`Achievement unlocks: ${r.candidateAchievements}`);
console.log(`Resume files:        ${r.resumeFiles}`);
console.log("");
console.log("Non-demo rows deleted (must be 0):");
const leaks = [
  ["candidates", r.preserved.candidates],
  ["jobs", r.preserved.jobs],
  ["applications", r.preserved.applications],
] as const;
const leaked = leaks.filter(([, n]) => n !== 0);
for (const [name, n] of leaks) {
  console.log(`  ${name.padEnd(13)} ${n === 0 ? green("0  ok") : red(`${n}  LEAK`)}`);
}
console.log("");
console.log(bar);
console.log(dim("Re-seed with: npm run seed:demo"));
if (leaked.length > 0) process.exit(1);

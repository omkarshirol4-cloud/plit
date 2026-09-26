/**
 * `npm run seed:demo` — populate the existing database with the synthetic
 * NovaHire Technologies demo dataset.
 *
 * Runs against SQLite directly through the same lib modules the HTTP routes
 * use. No Next.js, no browser, no ML service, no network of any kind: the
 * screening scores it writes are demo seed values, clearly namespaced as such.
 *
 * Safe to run repeatedly. Fixed `demo_` primary keys mean a second run
 * refreshes the same rows instead of adding new ones, and every reward goes
 * through the existing idempotent ledger.
 */
import { DEMO_CANDIDATES, DEMO_COMPANY, DEMO_SEED_REF } from "../lib/demo-data.ts";
import { demoDataPresent, seedDemo } from "../lib/demo-seed.ts";

const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bar = "=".repeat(44);

const already = demoDataPresent();

const t0 = Date.now();
const s = seedDemo();
const ms = Date.now() - t0;

console.log(already ? cyan("DEMO DATA RE-SEEDED (existing demo rows refreshed)") : cyan("DEMO DATA SEEDED"));
console.log(bar);
console.log(`Company: ${s.company}`);
console.log(`Industry: ${DEMO_COMPANY.industry}`);
console.log("");
console.log(`Jobs: ${s.jobs}`);
console.log(`Candidates: ${s.candidates}`);
console.log(`Applications: ${s.applications}`);
console.log(`Shortlist records: ${s.shortlistRecords}`);
console.log(`Assessments: ${s.assessments}`);
console.log(`Achievements: ${s.achievements}`);
console.log(`Token transactions: ${s.tokenTransactions}`);
console.log(`Verification records: ${s.verificationRecords}`);
console.log("");
console.log("Demo recruiter:");
console.log(`  ${DEMO_COMPANY.recruiterName}  <${s.recruiterEmail}>`);
console.log("");
console.log("Demo candidates:");
for (const c of DEMO_CANDIDATES) console.log(`  ${c.email}`);
console.log("");
console.log("Token balances (derived from each ledger, never assigned):");
for (const b of s.tokenBalances) console.log(`  ${String(b.balance).padStart(4)}  ${b.name}  <${b.email}>`);
console.log("");
console.log(bar);
if (already) {
  console.log(
    `New rows: ${s.created.candidates} candidates, ${s.created.jobs} jobs, ` +
      `${s.created.applications} applications, ${s.created.verifications} verifications`,
  );
  console.log(
    `Refreshed: ${s.updated.candidates} candidates, ${s.updated.jobs} jobs, ` +
      `${s.updated.applications} applications, ${s.updated.verifications} verifications`,
  );
}
console.log(yellow("All names, emails, resumes, verification signals and screening scores are synthetic."));
console.log(
  yellow(`Screening scores are demo seed values (${DEMO_SEED_REF}), not ML output.`) +
    dim(" Run screening on a shortlist to replace them with real model results."),
);
console.log(yellow("Verification signals are synthetic constants, not biometric measurements."));
console.log(green(`Done in ${ms}ms.`));
console.log(dim("Reset with: npm run reset:demo"));

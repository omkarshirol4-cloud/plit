import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOrCreateWallet } from "@/lib/tokens";
import { listAchievements } from "@/lib/achievements";
import { listAssessments } from "@/lib/assessments";
import { parseJsonArray } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candidates/[id]/dashboard — one request for the candidate home page.
 *
 * Read-only. Notably it does NOT compute or expose any score that feeds
 * recruiter ranking: the `rankScore` shown here is a copy of the existing ML
 * shortlist result so the candidate can see their own standing, and tokens are
 * never an input to it.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();

  const candidate = db
    .prepare("SELECT id, name, email, headline, skills, resumeName, resumePath FROM candidates WHERE id = ?")
    .get(id) as
    | { id: string; name: string; email: string; headline: string; skills: string; resumeName: string | null; resumePath: string | null }
    | undefined;
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const skills = parseJsonArray(candidate.skills);
  const hasResume = Boolean(candidate.resumePath);

  // Profile completeness: headline, at least 3 skills, and a resume on file.
  // These are the same three conditions the token rule and the PROFILE_COMPLETE
  // achievement use, so the progress bar cannot disagree with the reward.
  const checks = [
    Boolean(candidate.headline.trim()),
    skills.length >= 3,
    hasResume,
  ];
  const completedChecks = checks.filter(Boolean).length;
  const profilePercent = Math.round((completedChecks / checks.length) * 100);

  const wallet = getOrCreateWallet(id);

  // Verification: any session for one of this candidate's applications.
  const verification = db
    .prepare(
      `SELECT v.result, v.reviewedByHR, v.createdAt, a.id AS applicationId, j.title AS jobTitle
       FROM verification_sessions v
       JOIN applications a ON a.id = v.applicationId
       JOIN jobs j ON j.id = a.jobId
       WHERE a.candidateId = ?
       ORDER BY v.createdAt DESC LIMIT 1`,
    )
    .get(id) as
    | { result: string; reviewedByHR: number; createdAt: string; applicationId: string; jobTitle: string }
    | undefined;

  // Recommended jobs = open jobs the candidate has not applied to, best ML match
  // first. rankScore comes straight from shortlist_results, i.e. the existing
  // resume-screening output. Tokens are not part of this ordering.
  const recommended = db
    .prepare(
      `SELECT j.id, j.title, j.company, j.location,
              (SELECT s.rankScore FROM shortlist_results s
                 JOIN applications a2 ON a2.id = s.applicationId
                WHERE a2.jobId = j.id AND a2.candidateId = ? ORDER BY s.createdAt DESC LIMIT 1) AS rankScore
         FROM jobs j
        WHERE j.status = 'open'
          AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.jobId = j.id AND a.candidateId = ?)
        ORDER BY rankScore IS NULL, rankScore DESC, j.createdAt DESC
        LIMIT 5`,
    )
    .all(id, id) as Record<string, unknown>[];

  const assessments = listAssessments(false);
  const attempts = db
    .prepare("SELECT assessmentId, completed, score FROM assessment_attempts WHERE candidateId = ?")
    .all(id) as { assessmentId: string; completed: number; score: number | null }[];
  const attemptById = new Map(attempts.map((a) => [a.assessmentId, a]));

  const achievements = listAchievements(id);

  return NextResponse.json({
    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      headline: candidate.headline,
      skills,
      hasResume,
      resumeName: candidate.resumeName,
    },
    profile: { percent: profilePercent, completed: completedChecks, total: checks.length },
    wallet: { balance: wallet.balance, lifetimeEarned: wallet.lifetimeEarned, lifetimeSpent: wallet.lifetimeSpent },
    verification: verification
      ? {
          result: verification.result,
          reviewedByHR: Boolean(verification.reviewedByHR),
          applicationId: verification.applicationId,
          jobTitle: verification.jobTitle,
          createdAt: verification.createdAt,
        }
      : null,
    recommendedJobs: recommended.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      company: String(r.company),
      location: String(r.location ?? ""),
      // Null means "not screened yet" — shown as "—" rather than invented.
      rankScore: r.rankScore === null || r.rankScore === undefined ? null : Number(r.rankScore),
    })),
    assessments: assessments.map((a) => {
      const at = attemptById.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        tokenReward: a.tokenReward,
        questionCount: a.questionCount,
        completed: Boolean(at?.completed),
        score: at?.score ?? null,
      };
    }),
    achievements,
  });
}

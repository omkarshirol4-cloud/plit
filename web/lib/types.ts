export type Candidate = {
  id: string;
  name: string;
  email: string;
  headline: string;
  skills: string[];
  resumePath: string | null;
  resumeName: string | null;
  resumeText: string | null;
  createdAt: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requiredSkills: string[];
  status: string;
  createdAt: string;
};

export type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  note: string;
  status: string;
  createdAt: string;
};

export type ShortlistResult = {
  id: string;
  jobId: string;
  applicationId: string;
  rank: number;
  resumeScore: number;
  skillsScore: number;
  tfidfScore: number;
  rankScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  verificationMultiplier: number;
  createdAt: string;
};

export type VerificationResult = "pass" | "flagged" | "fail";

export type VerificationSession = {
  id: string;
  applicationId: string;
  gazeScore: number | null;
  lipSyncScore: number | null;
  audioScore: number | null;
  fusedScore: number | null;
  result: VerificationResult;
  reviewedByHR: boolean;
  reasons: string[];
  rawSignals: Record<string, unknown>;
  createdAt: string;
};

/** A shortlisted candidate as the recruiter UI needs it: everything joined. */
export type RankedCandidate = {
  rank: number;
  applicationId: string;
  candidateId: string;
  name: string;
  email: string;
  headline: string;
  resumeName: string | null;
  hasResume: boolean;
  resumeScore: number;
  skillsScore: number;
  tfidfScore: number;
  rankScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  verificationMultiplier: number;
  verification: {
    result: VerificationResult | null;
    gazeScore: number | null;
    lipSyncScore: number | null;
    audioScore: number | null;
    fusedScore: number | null;
    reviewedByHR: boolean;
    reasons: string[];
    createdAt: string | null;
  };
};

/** Candidate wallet as the rewards UI needs it. */
export type CandidateWallet = {
  id: string;
  candidateId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  createdAt: string;
  updatedAt: string;
};

export type TokenTransaction = {
  id: string;
  candidateId: string;
  amount: number;
  type: string;
  description: string;
  referenceId: string;
  createdAt: string;
};

/** Assessment question as sent to the browser. The answer key is never here. */
export type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type Assessment = {
  id: string;
  title: string;
  description: string;
  domain: string;
  active: boolean;
  tokenReward: number;
  questionCount: number;
  questions: AssessmentQuestion[];
  createdAt: string;
};

export type AssessmentAttempt = {
  id: string;
  candidateId: string;
  assessmentId: string;
  score: number | null;
  correctCount: number | null;
  totalCount: number | null;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  tokenReward: number;
  displayOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
};

/**
 * A just-unlocked achievement as returned by the evaluate/submit endpoints.
 *
 * Only ever contains genuinely new unlocks, so a UI can announce these without
 * re-announcing old ones. Mirrored from lib/achievements.ts, which cannot be
 * imported by client components because it reaches node:sqlite.
 */
export type UnlockedAchievement = {
  code: string;
  title: string;
  description: string;
  tokenReward: number;
  unlockedAt: string;
};

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Seed content for assessments and achievements.
 *
 * Pure data with no database import, so `db.ts` can seed on first connect
 * without a circular dependency.
 *
 * IMPORTANT: `answerIndex` is the answer key. It is stored server-side and is
 * stripped by every read path before the data reaches a client. `seed` writes
 * it to the database; `assessments.ts` `toPublicAssessment` never returns it.
 */

export type SeedQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
};

export type SeedAssessment = {
  id: string;
  title: string;
  description: string;
  domain: string;
  tokenReward: number;
  questions: SeedQuestion[];
};

export const SEED_ASSESSMENTS: SeedAssessment[] = [
  {
    id: "asm_psychology_fundamentals",
    title: "Psychology Fundamentals",
    description:
      "A short check on core behavioural-science concepts: conditioning, cognition, motivation and social influence.",
    domain: "psychology",
    tokenReward: 20,
    questions: [
      {
        id: "q1",
        prompt: "Classical conditioning was first systematically demonstrated by which pair of researchers?",
        options: ["Watson and Rayner", "Pavlov and Skinner", "Piaget and Vygotsky", "Freud and Jung"],
        answerIndex: 0,
      },
      {
        id: "q2",
        prompt: "In operant conditioning, a behaviour that is followed by removing an unpleasant stimulus is:",
        options: ["Positive reinforcement", "Negative reinforcement", "Positive punishment", "Negative punishment"],
        answerIndex: 1,
      },
      {
        id: "q3",
        prompt: "Which type of memory holds information for a fraction of a second with no rehearsal?",
        options: ["Sensory memory", "Short-term memory", "Long-term memory", "Procedural memory"],
        answerIndex: 0,
      },
      {
        id: "q4",
        prompt: "The tendency to overestimate how much others notice one's own appearance or behaviour is called:",
        options: ["Spotlight effect", "Dunning-Kruger effect", "Anchoring bias", "Confirmation bias"],
        answerIndex: 0,
      },
      {
        id: "q5",
        prompt: "Maslow's hierarchy of needs places which need at the base of the pyramid?",
        options: ["Safety", "Physiological", "Esteem", "Self-actualisation"],
        answerIndex: 1,
      },
      {
        id: "q6",
        prompt: "Cognitive dissonance describes discomfort caused by:",
        options: [
          "Conflicting beliefs or actions",
          "Excessive sensory input",
          "Lack of sleep",
          "Overwhelming fear of a specific object",
        ],
        answerIndex: 0,
      },
      {
        id: "q7",
        prompt: "Which learning style is most consistently supported by evidence in education research?",
        options: [
          "No learning style is reliably supported",
          "Visual learning is always superior",
          "Auditory learning is always superior",
          "Kinesthetic learning is always superior",
        ],
        answerIndex: 0,
      },
      {
        id: "q8",
        prompt: "In attribution theory, explaining a failure as 'the task was impossible' is an example of:",
        options: ["Internal attribution", "External attribution", "Fundamental attribution error", "Self-serving bias"],
        answerIndex: 1,
      },
      {
        id: "q9",
        prompt: "Short-term memory capacity for unrelated items is classically cited as:",
        options: ["About 3 items", "About 7 items", "About 20 items", "About 100 items"],
        answerIndex: 1,
      },
      {
        id: "q10",
        prompt: "Which effect describes people rating their own risk as lower than others'?",
        options: ["Optimism bias", "Anchoring bias", "Halo effect", "Sunk cost fallacy"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "asm_workplace_skills",
    title: "Workplace Skills",
    description:
      "Communication, collaboration, time management and judgement in a team setting.",
    domain: "workplace",
    tokenReward: 20,
    questions: [
      {
        id: "q1",
        prompt: "Which practice most reliably reduces misunderstandings on a written brief?",
        options: [
          "State the goal, owner and deadline explicitly",
          "Send it as quickly as possible",
          "Avoid written communication entirely",
          "Use as much jargon as possible",
        ],
        answerIndex: 0,
      },
      {
        id: "q2",
        prompt: "A teammate makes an error that affects your work. The most constructive first response is to:",
        options: [
          "Discuss it privately and focus on the fix",
          "Escalate to their manager immediately",
          "Ignore it and hope it resolves",
          "Replicate the error to make the pattern obvious",
        ],
        answerIndex: 0,
      },
      {
        id: "q3",
        prompt: "The Eisenhower matrix classifies urgent-but-unimportant work as:",
        options: ["Delegate or delete", "Do first", "Schedule for later", "Ignore entirely"],
        answerIndex: 0,
      },
      {
        id: "q4",
        prompt: "Active listening is best described as:",
        options: [
          "Giving full attention and confirming understanding",
          "Waiting for your turn to speak",
          "Taking detailed notes about style",
          "Repeating the speaker's words back verbatim",
        ],
        answerIndex: 0,
      },
      {
        id: "q5",
        prompt: "You must decline a request. The clearest way to do so is to:",
        options: [
          "Say no, give the reason, and offer an alternative",
          "Say yes and hope you cope",
          "Say nothing and let the deadline pass",
          "Blame a third party",
        ],
        answerIndex: 0,
      },
      {
        id: "q6",
        prompt: "Which is the strongest signal that a project is at risk of missing its deadline?",
        options: [
          "No progress updates while blockers go unrecorded",
          "A written status update with honest blockers",
          "A daily stand-up",
          "A shared task list",
        ],
        answerIndex: 0,
      },
      {
        id: "q7",
        prompt: "In a disagreement, the 'steel man' technique means:",
        options: [
          "Argue the other side as strongly as you can to test your own view",
          "Win the argument at all costs",
          "Avoid the topic entirely",
          "Repeat your own point louder",
        ],
        answerIndex: 0,
      },
      {
        id: "q8",
        prompt: "Feedback should ideally be:",
        options: [
          "Specific, timely and behaviour-focused",
          "Saved up for the annual review",
          "Anonymous and unspecific",
          "Delivered only to your manager",
        ],
        answerIndex: 0,
      },
      {
        id: "q9",
        prompt: "A useful retrospective should focus primarily on:",
        options: [
          "What to change next time",
          "Who to blame",
          "How long the meeting took",
          "Whether it met expectations only",
        ],
        answerIndex: 0,
      },
      {
        id: "q10",
        prompt: "What is the safest interpretation of silence in a meeting?",
        options: [
          "It is ambiguous; ask for input explicitly",
          "Everyone agrees",
          "Everyone disagrees",
          "Nobody was paying attention",
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "asm_problem_solving",
    title: "Problem Solving",
    description: "Breaking down unfamiliar problems and reasoning about edge cases.",
    domain: "analytical",
    tokenReward: 20,
    questions: [
      {
        id: "q1",
        prompt: "You have a vague problem statement. What is the best first step?",
        options: [
          "Restate the problem and identify a testable question",
          "Start coding immediately",
          "Pick the most complex tool available",
          "Wait for more problems to appear",
        ],
        answerIndex: 0,
      },
      {
        id: "q2",
        prompt: "A function works for every input except empty arrays. What is the most likely cause?",
        options: [
          "An unhandled edge case at the boundary",
          "The function is too slow",
          "The language is wrong",
          "The input is always invalid",
        ],
        answerIndex: 0,
      },
      {
        id: "q3",
        prompt: "Which is the best way to make a bug reproducible?",
        options: [
          "Find the smallest input that triggers it reliably",
          "Run it many times and hope",
          "Change unrelated code",
          "Only test in production",
        ],
        answerIndex: 0,
      },
      {
        id: "q4",
        prompt: "When a system is slow, the best first move is to:",
        options: [
          "Measure to find where the time actually goes",
          "Add more hardware",
          "Rewrite the slowest-looking module",
          "Disable logging",
        ],
        answerIndex: 0,
      },
      {
        id: "q5",
        prompt: "In a data pipeline, 'idempotent' means:",
        options: [
          "Running it twice has the same effect as running it once",
          "It always finishes in under a second",
          "It never fails",
          "It can only run on one machine",
        ],
        answerIndex: 0,
      },
      {
        id: "q6",
        prompt: "What is the strongest reason to write a test before fixing a bug?",
        options: [
          "It proves the bug existed and stays fixed",
          "It makes the code shorter",
          "It removes the need to read the code",
          "It guarantees no other bugs exist",
        ],
        answerIndex: 0,
      },
      {
        id: "q7",
        prompt: "Which is an example of a reversible decision?",
        options: [
          "Choosing a library version for a prototype",
          "Deleting production data",
          "Changing a database column type in use",
          "Sending an irreversible external email",
        ],
        answerIndex: 0,
      },
      {
        id: "q8",
        prompt: "A value that should be an integer arrives as a string. The best defensive step is:",
        options: [
          "Validate and convert at the boundary",
          "Ignore it",
          "Assume it is always correct",
          "Cast it with a bare assertion and move on",
        ],
        answerIndex: 0,
      },
      {
        id: "q9",
        prompt: "Root-cause analysis is most useful when it:",
        options: [
          "Identifies the underlying cause rather than the symptom",
          "Closes the ticket quickly",
          "Assigns responsibility to a person",
          "Avoids reproducing the issue",
        ],
        answerIndex: 0,
      },
      {
        id: "q10",
        prompt: "A heuristic that is nearly always right should be treated as:",
        options: [
          "A rule with a known set of exceptions",
          "An absolute law",
          "A reason to skip verification",
          "Irrelevant to the problem",
        ],
        answerIndex: 0,
      },
    ],
  },
];

/**
 * Achievement definitions. `code` is stable and is what the token ledger uses
 * as its referenceId, so a reward can be traced back to exactly one definition.
 */
export const SEED_ACHIEVEMENTS = [
  {
    code: "FIRST_APPLICATION",
    title: "First Step",
    description: "Complete your first job application",
    tokenReward: 10,
    displayOrder: 1,
  },
  {
    code: "PROFILE_COMPLETE",
    title: "Profile Ready",
    description: "Complete your profile and resume",
    tokenReward: 20,
    displayOrder: 2,
  },
  {
    code: "VERIFIED_CANDIDATE",
    title: "Verified",
    description: "Complete verification",
    tokenReward: 25,
    displayOrder: 3,
  },
  {
    code: "FIRST_ASSESSMENT",
    title: "Test Ready",
    description: "Complete your first assessment",
    tokenReward: 20,
    displayOrder: 4,
  },
  {
    code: "ACTIVE_JOB_SEEKER",
    title: "Active Job Seeker",
    description: "Apply to 5 jobs",
    tokenReward: 25,
    displayOrder: 5,
  },
  {
    code: "CONSISTENT_CANDIDATE",
    title: "Consistent",
    description: "Meaningful activity on 5 different days",
    tokenReward: 30,
    displayOrder: 6,
  },
] as const;

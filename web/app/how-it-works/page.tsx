import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "Four steps from a challenge to a hire, with the evidence attached.",
};

const STEPS = [
  {
    title: "Pick a challenge",
    body: "Choose an open role and see the exact skills it screens for.",
  },
  {
    title: "Build and submit",
    body: "Add your profile and resume, then sit the role's assessment. It is graded server-side.",
  },
  {
    title: "Verify",
    body: "Record a short webcam defense. Gaze, lip-sync and audio are scored, then fused.",
  },
  {
    title: "Get discovered",
    body: "Verified work feeds the ranking, so recruiters reach you on evidence.",
  },
];

/**
 * /how-it-works -- a single linear path rather than a page per persona.
 *
 * The old landing page carried two parallel five-step flows side by side, which
 * doubled the length of the entry screen to describe one idea. Four steps and
 * one column is the whole story; the recruiter view of it is the same story
 * read from the other end.
 */
export default function HowItWorksPage() {
  return (
    <div className="prose-page">
      <h1>How it works</h1>
      <p className="prose-lede">
        One path, end to end. A recruiter reads it from the far side: define the role, discover candidates, review the
        proof, verify what the model flagged.
      </p>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li className="step" key={s.title}>
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h2 className="step-title">{s.title}</h2>
              <p className="step-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="muted small" style={{ marginTop: 28 }}>
        Nothing on this page is an engagement reward or a token. Tokens are paid once for completing work and never
        affect screening, verification or ranking.
      </p>
    </div>
  );
}

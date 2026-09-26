import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why hiring should rest on evidence rather than assertion.",
};

/**
 * /about -- kept to a few sentences on purpose. The landing page links here
 * instead of carrying an About block, so a first-time visitor is not made to
 * scroll past company prose to reach the two role CTAs.
 */
export default function AboutPage() {
  return (
    <div className="prose-page">
      <h1>About</h1>
      <p className="prose-lede">
        Hiring mostly runs on a document a candidate writes about themselves, screened largely by keyword. That is a
        weak signal, and everyone involved knows it.
      </p>
      <p>
        This platform replaces some of that guesswork with evidence: a candidate does something real, the system
        records what happened, and a recruiter reviews the record.
      </p>
      <p>
        The score exists to order a review queue, not to make the decision. Where a model is unsure, a person decides.
      </p>
    </div>
  );
}

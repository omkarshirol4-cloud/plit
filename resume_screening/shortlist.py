"""
Rank a job's applicants by the resume-screening score.

Input is the applicant pool the backend hands over (id + resume text +
required skills); output is the same list sorted best-first with scores
and per-signal breakdowns attached. The backend persists the result as
ShortlistResult rows and renders the ranking -- this module never touches
a database itself.

Also folds in the verification multiplier documented in
docs/anti-gaming-paper.md section 1, so a candidate who has cleared the
live webcam check outranks an identical resume that hasn't been verified
(or that came back flagged). The multiplier is applied to the final
ranking score only -- it never changes the resume score itself, so the
recruiter UI can still show the unmodified resume score.
"""

from __future__ import annotations

from .score import score_resume

# Section 1 of docs/anti-gaming-paper.md. `fail` is deliberately absent --
# a "fail" is a strong recommendation for human review, not a verdict, so
# it keeps the unresolved `flagged` multiplier until a human disposes of it.
VERIFICATION_MULTIPLIERS = {
    "pass": 1.2,
    None: 1.0,
    "flagged": 0.5,
    "fail": 0.5,
}


def verification_multiplier(result: str | None) -> float:
    return VERIFICATION_MULTIPLIERS.get(result, 1.0)


def shortlist(
    job_id: str,
    required_skills: list[str],
    applicants: list[dict],
) -> list[dict]:
    """
    applicants: [{"applicationId", "candidateId", "name", "resumeText",
                   "verificationResult"}]  (verificationResult may be None)

    Returns the same applicants, sorted by rankScore descending, each with
    resumeScore / skillsScore / tfidfScore / matchedSkills / missingSkills
    / verificationMultiplier / rank attached.
    """
    if not applicants:
        return []

    corpus = [a.get("resumeText") or "" for a in applicants]

    scored = []
    for applicant, text in zip(applicants, corpus):
        detail = score_resume(text or "", required_skills, pool_texts=corpus)
        multiplier = verification_multiplier(applicant.get("verificationResult"))
        scored.append({
            "applicationId": applicant.get("applicationId"),
            "candidateId": applicant.get("candidateId"),
            "name": applicant.get("name") or "(unnamed)",
            "resumeScore": detail["score"],
            "skillsScore": detail["skills_score"],
            "tfidfScore": detail["tfidf_score"],
            "matchedSkills": detail["matched_skills"],
            "missingSkills": detail["missing_skills"],
            "verificationResult": applicant.get("verificationResult"),
            "verificationMultiplier": multiplier,
            "rankScore": round(detail["score"] * multiplier, 4),
        })

    scored.sort(key=lambda r: r["rankScore"], reverse=True)
    for i, row in enumerate(scored, start=1):
        row["rank"] = i
        row["jobId"] = job_id

    return scored

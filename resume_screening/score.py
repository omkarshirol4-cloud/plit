"""
TF-IDF + skills scoring of a single resume against a job's requirements.

Two independent signals, deliberately kept separate so the recruiter UI
can show *why* a candidate ranked where they did:

  1. skills_score  -- fraction of the job's required skills that literally
                      appear in the resume text. Hard requirement, so it
                      dominates.
  2. tfidf_score   -- cosine similarity between the resume and a corpus
                      built from the job's title/description plus every
                      other applicant's resume. Catches "reads like a
                      good fit for this kind of role" even when the exact
                      skill strings differ (e.g. "Postgres" vs
                      "postgresql").

Both live in [0, 1]. The combined score is what shortlist.py ranks on.

Note on the TF-IDF half: a single-document corpus makes IDF degenerate
(every term appears in the one document, so IDF is uniform and cosine
reduces to raw term overlap). We therefore always fit the vectorizer
across the whole applicant pool for a job, never on one resume alone.
"""

from __future__ import annotations

import re

SKILL_WEIGHT = 0.7
TFIDF_WEIGHT = 0.3

# Skills are matched on word boundaries, case-insensitively, with a few
# common aliases folded together so "node.js"/"nodejs"/"node js" all hit.
SKILL_ALIASES = {
    "node.js": ["node.js", "nodejs", "node js"],
    "next.js": ["next.js", "nextjs", "next js"],
    "react": ["react", "react.js", "reactjs"],
    "postgresql": ["postgresql", "postgres", "psql", "postgre sql"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["aws", "amazon web services"],
    "machine learning": ["machine learning", "ml", "deep learning"],
    "tensorflow": ["tensorflow", "tf"],
    "pytorch": ["pytorch", "torch"],
    "docker": ["docker", "containerization", "containers"],
    "ci/cd": ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
    "rest": ["rest", "restful", "rest api", "restful api"],
}


def _variants(skill: str) -> list[str]:
    key = skill.strip().lower()
    return SKILL_ALIASES.get(key, [key])


def matched_skills(resume_text: str, required_skills: list[str]) -> list[str]:
    """Required skills that literally show up in the resume."""
    haystack = resume_text.lower()
    hits = []
    for skill in required_skills:
        for variant in _variants(skill):
            # \b around a variant containing '.' or '/' behaves oddly, so
            # fall back to a plain substring test for those.
            pattern = re.escape(variant)
            if re.search(r"[./]", variant):
                if pattern in haystack:
                    hits.append(skill)
                    break
            elif re.search(rf"\b{pattern}\b", haystack):
                hits.append(skill)
                break
    return hits


def missing_skills(resume_text: str, required_skills: list[str]) -> list[str]:
    hits = set(matched_skills(resume_text, required_skills))
    return [s for s in required_skills if s not in hits]


def skills_score(resume_text: str, required_skills: list[str]) -> float:
    if not required_skills:
        return 0.0
    return len(matched_skills(resume_text, required_skills)) / len(required_skills)


def _build_vectorizer(corpus: list[str]):
    from sklearn.feature_extraction.text import TfidfVectorizer

    return TfidfVectorizer(
        stop_words="english",
        # Resume bullets are short; 1-2 grams survive the "bag of words"
        # soup that 3+ grams produce on documents this short.
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )


def tfidf_scores(query_text: str, corpus: list[str]) -> list[float]:
    """
    Cosine similarity of query_text against every document in corpus.
    Returns a list parallel to corpus. With a 1-document corpus this is
    near-meaningless, so we return zeros and let the caller fall back to
    skills-only ranking.
    """
    if len(corpus) < 2:
        return [0.0] * len(corpus)

    from sklearn.metrics.pairwise import cosine_similarity

    try:
        vectorizer = _build_vectorizer(corpus + [query_text])
        matrix = vectorizer.fit_transform(corpus + [query_text])
    except ValueError:
        # Empty vocabulary (e.g. every document was pure stopwords).
        return [0.0] * len(corpus)

    sims = cosine_similarity(matrix[-1], matrix[:-1])[0]
    return [float(s) for s in sims]


def score_resume(
    resume_text: str,
    required_skills: list[str],
    pool_texts: list[str] | None = None,
) -> dict:
    """
    Scores one resume. `pool_texts` is every other applicant's resume text
    for the same job -- only used to give the TF-IDF half a corpus to be
    meaningful against. Omit it and the TF-IDF half scores 0.
    """
    skills = skills_score(resume_text, required_skills)
    hits = matched_skills(resume_text, required_skills)
    misses = [s for s in required_skills if s not in set(hits)]

    tfidf = 0.0
    if pool_texts is not None:
        others = [t for t in pool_texts if t != resume_text]
        sims = tfidf_scores(resume_text, others)
        # Rescale: raw cosine against sibling resumes clusters in a narrow
        # band near 0, which would make this term contribute almost nothing.
        # Spread the observed band across [0, 1] so it actually separates.
        if sims:
            lo, hi = min(sims), max(sims)
            tfidf = 0.0 if hi - lo < 1e-9 else (sims[0] - lo) / (hi - lo)

    combined = SKILL_WEIGHT * skills + TFIDF_WEIGHT * tfidf

    return {
        "score": round(combined, 4),
        "skills_score": round(skills, 4),
        "tfidf_score": round(tfidf, 4),
        "matched_skills": hits,
        "missing_skills": misses,
    }

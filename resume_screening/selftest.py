r"""
Smoke test for the resume-screening pipeline. Not a pytest suite -- just
run it and read the ranked table:

    .venv\Scripts\python.exe -m resume_screening.selftest
"""

from __future__ import annotations

from .extract_text import extract_text
from .shortlist import shortlist

SAMPLES = {
    "alice": """
Alice Chen — Senior Backend Engineer
8 years building distributed systems.
Skills: Python, Go, PostgreSQL, Kubernetes, AWS, Docker, Terraform.
Built event-driven payment services handling 40k requests/sec.
Designed CI/CD pipelines with automated testing and staged rollouts.
""",
    "bob": """
Bob Martinez — Frontend Engineer
6 years of UI work. Skills: React, TypeScript, Next.js, Node.js, CSS.
Shipped design systems and accessibility improvements to a checkout flow.
""",
    "carol": """
Carol Singh — Data Scientist
Skills: Python, machine learning, TensorFlow, PyTorch, SQL, pandas.
Built recommendation models and A/B testing infrastructure.
""",
    "dave": """
Dave Okafor — DevOps Engineer
Skills: Kubernetes, AWS, Docker, Terraform, CI/CD, Linux, Go.
Automated infrastructure provisioning and on-call reliability work.
""",
}

REQUIRED = ["Python", "PostgreSQL", "Kubernetes", "AWS", "Docker", "CI/CD"]


def main() -> None:
    print("=== extract_text ===")
    for name, text in SAMPLES.items():
        recovered = extract_text(text.encode("utf-8"), filename=f"{name}.txt")
        print(f"  {name:6s} {len(recovered):4d} chars  ok={bool(recovered)}")

    applicants = [
        {
            "applicationId": f"app-{name}",
            "candidateId": f"cand-{name}",
            "name": name,
            "resumeText": text,
            "verificationResult": None,
        }
        for name, text in SAMPLES.items()
    ]
    # Alice has already passed the webcam check; give her the 1.2x multiplier.
    applicants[0]["verificationResult"] = "pass"

    print("\n=== shortlist (required: " + ", ".join(REQUIRED) + ") ===")
    results = shortlist("job-1", REQUIRED, applicants)
    header = f"{'#':<3}{'name':<8}{'rank':<8}{'resume':<9}{'skills':<8}{'tfidf':<8}{'mult':<6}matched"
    print(header)
    print("-" * len(header))
    for r in results:
        print(
            f"{r['rank']:<3}{r['name']:<8}{r['rankScore']:<8.3f}"
            f"{r['resumeScore']:<9.3f}{r['skillsScore']:<8.3f}"
            f"{r['tfidfScore']:<8.3f}{r['verificationMultiplier']:<6.1f}"
            f"{','.join(r['matchedSkills'])}"
        )

    ranked = [r["name"] for r in results]
    assert ranked[0] == "alice", f"verified backend dev should rank first, got {ranked}"
    assert ranked[-1] == "bob", f"frontend dev with 0 required skills should rank last, got {ranked}"
    assert ranked.index("dave") < ranked.index("carol"), "4 matched skills should outrank 1"
    assert results == sorted(results, key=lambda r: r["rankScore"], reverse=True)
    print("\nOK")


if __name__ == "__main__":
    main()

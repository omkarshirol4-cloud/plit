"""
FastAPI wrapper around the resume-screening pipeline, mirroring how
ml/verification/service.py exposes the anti-gaming pipeline.

Run: uvicorn resume_screening.service:app --reload --port 8002

The Next.js backend does NOT call this directly. It POSTs the applicant
pool to /shortlist, gets ranked rows back, and persists them as
ShortlistResult. Keeping the ML behind an HTTP boundary (rather than
importing it) means the web app never needs scikit-learn installed and
the two services can be restarted independently during the demo.
"""

from __future__ import annotations

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel, Field

from .extract_text import extract_text
from .shortlist import shortlist as run_shortlist

app = FastAPI(title="Resume Screening Service")


class Applicant(BaseModel):
    applicationId: str
    candidateId: str
    name: str = ""
    resumeText: str = ""
    verificationResult: str | None = None


class ShortlistRequest(BaseModel):
    jobId: str
    requiredSkills: list[str] = Field(default_factory=list)
    applicants: list[Applicant]


class ShortlistResponse(BaseModel):
    jobId: str
    requiredSkills: list[str]
    results: list[dict]


@app.post("/shortlist")
def shortlist_endpoint(req: ShortlistRequest) -> ShortlistResponse:
    results = run_shortlist(
        job_id=req.jobId,
        required_skills=req.requiredSkills,
        applicants=[a.model_dump() for a in req.applicants],
    )
    return ShortlistResponse(
        jobId=req.jobId,
        requiredSkills=req.requiredSkills,
        results=results,
    )


@app.post("/extract")
async def extract_endpoint(file: UploadFile = File(...)) -> dict:
    """Plain-text extraction for a single uploaded resume (.pdf/.docx/.txt).

    The web app calls this at upload time so the parsed text is stored on
    the candidate row and can be shown back to them immediately."""
    data = await file.read()
    try:
        text = extract_text(data, filename=file.filename or "")
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"text": text, "characters": len(text)}


@app.get("/health")
def health():
    return {"status": "ok"}

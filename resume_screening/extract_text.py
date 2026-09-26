"""
Text extraction from uploaded resumes.

Handles the three formats a candidate will realistically upload in a
hackathon demo: PDF, DOCX, and plain text. PDF goes through pypdf; DOCX
is just a zip containing word/document.xml, so the stdlib handles it and
we avoid pulling in python-docx for one regex.
"""

from __future__ import annotations

import io
import re
import zipfile

_WS_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def _from_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _from_docx(data: bytes) -> str:
    """A .docx is a zip; the body text lives in word/document.xml as a run
    of <w:t> nodes. Paragraphs are <w:p>, so turn those into newlines."""
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", errors="replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    xml = re.sub(r"<w:br[^>]*/>", "\n", xml)
    texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml, re.DOTALL)
    # Un-escape the handful of XML entities that show up in real resumes.
    joined = "".join(texts)
    for entity, char in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&apos;", "'")):
        joined = joined.replace(entity, char)
    return joined


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def extract_text(data: bytes, filename: str = "") -> str:
    """
    Returns cleaned resume text. Raises ValueError if the format is
    unsupported or no text could be recovered -- callers decide whether
    that's a hard failure or a neutral score.
    """
    name = (filename or "").lower()

    if name.endswith(".pdf") or data[:4] == b"%PDF":
        raw = _from_pdf(data)
    elif name.endswith(".docx") or data[:2] == b"PK":
        raw = _from_docx(data)
    elif name.endswith((".txt", ".md", ".rtf")):
        raw = data.decode("utf-8", errors="replace")
    else:
        raise ValueError(
            f"unsupported resume format: {filename or 'unknown'} "
            "(expected .pdf, .docx, or .txt)"
        )

    cleaned = _clean(raw)
    if not cleaned:
        raise ValueError(f"no text could be extracted from {filename or 'upload'}")
    return cleaned


def extract_text_from_file(path: str) -> str:
    with open(path, "rb") as f:
        return extract_text(f.read(), filename=path)

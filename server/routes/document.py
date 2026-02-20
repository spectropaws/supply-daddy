"""
Document routes — Upload and parse PDF/text documents for shipment creation.
Returns extracted text for GenAI classification.
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

try:
    import pdfplumber
    _HAS_PDF = True
except ImportError:
    _HAS_PDF = False
    logger.warning("pdfplumber not installed — PDF parsing will not work")


@router.post("/parse", response_model=dict)
async def parse_document(file: UploadFile = File(...)):
    """
    Upload a PDF or text file and extract its text content.
    Supports: PDF, TXT, CSV
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()
    content = await file.read()

    if filename.endswith(".pdf"):
        if not _HAS_PDF:
            raise HTTPException(status_code=500, detail="PDF parsing not available (pdfplumber not installed)")
        try:
            import io
            text_parts = []
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            extracted_text = "\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

    elif filename.endswith((".txt", ".csv", ".text")):
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content.decode("latin-1")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {filename}. Supported: .pdf, .txt, .csv",
        )

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file")

    return {
        "filename": file.filename,
        "text": extracted_text,
        "char_count": len(extracted_text),
    }

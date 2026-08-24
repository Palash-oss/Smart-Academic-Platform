import os
import math
from typing import List, Dict, Any, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.config import settings
from app.db.models import DocumentEmbedding, Document

try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False


def generate_fallback_embedding(text: str, dim: int = 768) -> List[float]:
    """Generates a deterministic 768-dimensional normalized embedding for text when API key is unconfigured."""
    import hashlib
    hash_obj = hashlib.sha256(text.encode('utf-8'))
    seed = int(hash_obj.hexdigest(), 16)
    
    vec = []
    for i in range(dim):
        val = math.sin(seed + i * 0.1)
        vec.append(val)
    
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def get_text_embedding(text_content: str) -> List[float]:
    """Generates a 768-dimensional embedding using Gemini API if configured, else fallback."""
    if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text_content,
                task_type="retrieval_document"
            )
            embedding = result['embedding']
            if len(embedding) == 768:
                return embedding
        except Exception as e:
            print(f"[Warning] Gemini embedding failed ({e}), falling back to deterministic vector.")
    
    return generate_fallback_embedding(text_content, 768)


async def retrieve_relevant_documents(
    db: AsyncSession,
    query: str,
    department_id: Optional[uuid.UUID] = None,
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """Retrieves top-k relevant document chunks using pgvector vector_cosine_ops distance.
    Enforces Department Scoping: Returns general university policy documents + student's department syllabus.
    Excludes other departments' syllabi.
    """
    query_vector = get_text_embedding(query)
    
    try:
        stmt = (
            select(DocumentEmbedding, Document)
            .join(Document, DocumentEmbedding.document_id == Document.id)
        )
        
        if department_id:
            stmt = stmt.where(
                or_(
                    Document.department_id == department_id,
                    Document.department_id.is_(None)
                )
            )

        stmt = stmt.order_by(DocumentEmbedding.embedding.cosine_distance(query_vector)).limit(top_k)
        result = await db.execute(stmt)
        rows = result.all()
    except Exception:
        stmt = (
            select(DocumentEmbedding, Document)
            .join(Document, DocumentEmbedding.document_id == Document.id)
        )
        if department_id:
            stmt = stmt.where(
                or_(
                    Document.department_id == department_id,
                    Document.department_id.is_(None)
                )
            )
        stmt = stmt.limit(top_k)
        result = await db.execute(stmt)
        rows = result.all()

    documents_found = []
    for chunk, doc in rows:
        documents_found.append({
            "chunk_id": str(chunk.id),
            "document_id": str(doc.id),
            "document_title": doc.title,
            "doc_type": doc.doc_type,
            "chunk_text": chunk.chunk_text,
            "chunk_index": chunk.chunk_index
        })

    return documents_found

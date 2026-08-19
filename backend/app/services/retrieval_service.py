import os
import math
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.config import settings
from app.db.models import DocumentEmbedding, Document

# Try importing Google GenAI for embedding generation
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
        # Pseudo-random float between -1 and 1
        val = math.sin(seed + i * 0.1)
        vec.append(val)
    
    # Normalize vector
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
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """Retrieves top-k relevant document chunks using pgvector vector_cosine_ops distance."""
    query_vector = get_text_embedding(query)
    
    try:
        stmt = (
            select(DocumentEmbedding, Document)
            .join(Document, DocumentEmbedding.document_id == Document.id)
            .order_by(DocumentEmbedding.embedding.cosine_distance(query_vector))
            .limit(top_k)
        )
        result = await db.execute(stmt)
        rows = result.all()
    except Exception:
        # Fallback query if pgvector extension is not enabled in local postgres
        stmt = (
            select(DocumentEmbedding, Document)
            .join(Document, DocumentEmbedding.document_id == Document.id)
            .limit(top_k)
        )
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

import sys
import os
import uuid
from typing import List

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal, sync_engine, Base
from app.db.models import Document, DocumentEmbedding
from app.services.retrieval_service import get_text_embedding

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 80) -> List[str]:
    """Splits long text into overlapping chunks of approximately chunk_size characters."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk.strip())
        start += (chunk_size - overlap)
    return [c for c in chunks if len(c) > 20]


def ingest_file(file_path: str, doc_title: str, doc_type: str = "policy"):
    """Ingests a PDF or TXT file into database and generates 768d embeddings."""
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    content = ""
    if file_path.endswith(".pdf") and HAS_PYPDF:
        reader = PdfReader(file_path)
        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            content += f"\n--- Page {idx + 1} ---\n" + page_text
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

    chunks = chunk_text(content)
    print(f"Extracted {len(chunks)} chunks from '{doc_title}'")

    session = SyncSessionLocal()
    try:
        # Delete any existing document with same title
        existing_docs = session.query(Document).filter(Document.title == doc_title).all()
        for ed in existing_docs:
            session.delete(ed)
        session.commit()

        doc = Document(
            title=doc_title,
            doc_type=doc_type,
            source_path=file_path
        )
        session.add(doc)
        session.commit()

        for idx, chunk in enumerate(chunks):
            embedding = get_text_embedding(chunk)
            doc_emb = DocumentEmbedding(
                document_id=doc.id,
                chunk_text=chunk,
                embedding=embedding,
                chunk_index=idx
            )
            session.add(doc_emb)

        session.commit()
        print(f"Successfully ingested '{doc_title}' ({len(chunks)} chunks) into pgvector!")
    except Exception as e:
        session.rollback()
        print(f"Failed to ingest file: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        title = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(filepath)
        ingest_file(filepath, title)
    else:
        print("Usage: python ingest_docs.py <path_to_pdf_or_txt> <document_title>")

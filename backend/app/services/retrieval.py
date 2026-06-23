import math

from pgvector.sqlalchemy import Vector
from sqlalchemy import select, type_coerce
from sqlalchemy.orm import Session

from app.models import PolicyChunk
from app.services.embeddings import embed_text


def _cosine(left: list[float], right: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    return numerator / (left_norm * right_norm) if left_norm and right_norm else 0


def retrieve_policy(db: Session, query: str, country: str, limit: int = 3) -> list[PolicyChunk]:
    query_embedding = embed_text(query)
    if db.bind and db.bind.dialect.name == "postgresql":
        vector_column = type_coerce(PolicyChunk.embedding, Vector(1536))
        return list(db.scalars(
            select(PolicyChunk)
            .where(PolicyChunk.country.in_([country, "Global"]))
            .order_by(vector_column.cosine_distance(query_embedding))
            .limit(limit)
        ).all())
    chunks = db.scalars(
        select(PolicyChunk).where(PolicyChunk.country.in_([country, "Global"]))
    ).all()
    ranked = sorted(chunks, key=lambda chunk: _cosine(query_embedding, chunk.embedding), reverse=True)
    return ranked[:limit]

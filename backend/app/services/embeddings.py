import hashlib
import math
import re

from openai import OpenAI

from app.config import get_settings


DIMENSIONS = 1536


def embed_text(text: str) -> list[float]:
    settings = get_settings()
    if settings.ai_provider == "openai" and settings.openai_api_key:
        response = OpenAI(api_key=settings.openai_api_key).embeddings.create(
            model=settings.openai_embedding_model,
            input=text,
        )
        return response.data[0].embedding

    vector = [0.0] * DIMENSIONS
    for token in re.findall(r"[a-z0-9]+", text.lower()):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % DIMENSIONS
        vector[index] += 1.0 if digest[4] % 2 == 0 else -1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


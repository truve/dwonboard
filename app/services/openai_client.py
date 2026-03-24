import logging
import asyncio

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_KEY)
    return _client


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> str:
    client = get_openai_client()
    model = model or settings.OPENAI_CHAT_MODEL

    for attempt in range(3):
        try:
            kwargs: dict = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format is not None:
                kwargs["response_format"] = response_format

            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.warning(f"OpenAI call attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)

    return ""


async def create_embeddings(
    texts: list[str],
    model: str | None = None,
) -> list[list[float]]:
    client = get_openai_client()
    model = model or settings.OPENAI_EMBEDDING_MODEL

    all_embeddings: list[list[float]] = []
    batch_size = 2048

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(model=model, input=batch)
        all_embeddings.extend([item.embedding for item in response.data])

    return all_embeddings

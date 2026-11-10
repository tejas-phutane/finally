"""Chat completion client: LiteLLM -> OpenRouter -> Cerebras, with structured output.

Never raises for provider or parsing failures; returns an LLMResponse explaining the problem.
"""

import logging
import os

import litellm
from pydantic import ValidationError

from app.llm.mock import mock_response
from app.llm.prompts import build_messages
from app.llm.schemas import LLMResponse

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
FAILURE_MESSAGE = "Sorry, I couldn't get a usable answer from the AI service. Please try again."


def _llm_mock_enabled() -> bool:
    return os.environ.get("LLM_MOCK", "").strip().lower() == "true"


def _safe_error_text(exc: BaseException) -> str:
    """Exception text with the API key value redacted, so it never reaches the logs."""
    text = str(exc)
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if key:
        text = text.replace(key, "[REDACTED]")
    return text


async def chat_completion(
    user_message: str,
    history: list[dict],
    portfolio_context: dict,
) -> LLMResponse:
    """Return the assistant's structured response to a user message."""
    if _llm_mock_enabled():
        return mock_response(user_message)

    try:
        messages = build_messages(user_message, history, portfolio_context)
        response = await litellm.acompletion(
            model=MODEL,
            messages=messages,
            response_format=LLMResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        content = response.choices[0].message.content
        if not content:
            logger.warning("LLM returned empty content")
            return LLMResponse(message=FAILURE_MESSAGE)
        return LLMResponse.model_validate_json(content)
    except ValidationError as exc:
        logger.warning("LLM returned invalid structured output: %s", type(exc).__name__)
        return LLMResponse(message=FAILURE_MESSAGE)
    except Exception as exc:  # provider errors, network errors, bad responses
        logger.warning("LLM call failed: %s: %s", type(exc).__name__, _safe_error_text(exc))
        return LLMResponse(message=FAILURE_MESSAGE)

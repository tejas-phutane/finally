"""chat_completion in real mode (litellm.acompletion monkeypatched) and mock mode."""

import pytest

from app.llm import client as client_mod
from app.llm.client import FAILURE_MESSAGE, chat_completion
from app.llm.schemas import LLMResponse


class _Msg:
    def __init__(self, content):
        self.content = content


class _Choice:
    def __init__(self, content):
        self.message = _Msg(content)


class _Resp:
    def __init__(self, content):
        self.choices = [_Choice(content)]


@pytest.fixture
def real_mode(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-secret-123")


def _patch_acompletion(monkeypatch, *, content=None, exc=None, calls=None):
    async def fake(**kwargs):
        if calls is not None:
            calls.append(kwargs)
        if exc is not None:
            raise exc
        return _Resp(content)

    monkeypatch.setattr(client_mod.litellm, "acompletion", fake)


async def test_real_mode_parses_valid_json(monkeypatch, real_mode):
    calls = []
    _patch_acompletion(
        monkeypatch,
        content='{"message": "Bought", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 3}]}',
        calls=calls,
    )
    r = await chat_completion("buy 3 AAPL", [], {})
    assert r.message == "Bought"
    assert r.trades[0].ticker == "AAPL"
    kwargs = calls[0]
    assert kwargs["model"] == "openrouter/openai/gpt-oss-120b"
    assert kwargs["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert kwargs["response_format"] is LLMResponse
    assert kwargs["reasoning_effort"] == "low"


async def test_real_mode_invalid_json_returns_failure(monkeypatch, real_mode):
    _patch_acompletion(monkeypatch, content="not json at all")
    r = await chat_completion("hi", [], {})
    assert r.message == FAILURE_MESSAGE
    assert r.trades == [] and r.watchlist_changes == []


async def test_real_mode_schema_violation_returns_failure(monkeypatch, real_mode):
    _patch_acompletion(
        monkeypatch,
        content='{"message": "x", "trades": [{"ticker": "A", "side": "hold", "quantity": 1}]}',
    )
    r = await chat_completion("hi", [], {})
    assert r.message == FAILURE_MESSAGE
    assert r.trades == []


async def test_real_mode_empty_content_returns_failure(monkeypatch, real_mode):
    _patch_acompletion(monkeypatch, content="")
    r = await chat_completion("hi", [], {})
    assert r.message == FAILURE_MESSAGE


async def test_real_mode_provider_exception_returns_failure(monkeypatch, real_mode, caplog):
    _patch_acompletion(monkeypatch, exc=RuntimeError("upstream down sk-test-secret-123"))
    with caplog.at_level("WARNING"):
        r = await chat_completion("hi", [], {})
    assert r.message == FAILURE_MESSAGE
    assert "sk-test-secret-123" not in caplog.text
    assert "RuntimeError" in caplog.text


async def test_mock_mode_skips_network(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")

    async def boom(**kwargs):
        raise AssertionError("network must not be called in mock mode")

    monkeypatch.setattr(client_mod.litellm, "acompletion", boom)
    r = await chat_completion("sell 2 MSFT", [], {})
    assert r.trades[0].side == "sell"
    assert r.trades[0].ticker == "MSFT"


async def test_mock_mode_watchlist(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    r = await chat_completion("remove NFLX", [], {})
    assert r.watchlist_changes[0].action == "remove"

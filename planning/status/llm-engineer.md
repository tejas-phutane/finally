# LLM Engineer — Status

## Done
- `backend/app/llm/`: `schemas.py` (TradeInstruction, WatchlistChange, LLMResponse), `prompts.py` (system prompt, portfolio text, message builder), `mock.py` (LLM_MOCK rules), `client.py` (`chat_completion`), `__init__.py`.
- `backend/tests/llm/`: 25 tests (schemas, mock rules, prompts, client real/mock modes). No network calls.
- Tests: 25 passed. `ruff check` and `ruff format --check` clean for `app/llm` and `tests/llm`.
- Live check: one real call through `chat_completion` (Cerebras via OpenRouter) returned a non-empty, non-fallback response. PASS.

## In progress
- None.

## Blocked
- None.

## Contract changes
- None. `chat_completion` uses `litellm.acompletion` (async) rather than `completion` in a thread.
- `extra fields` in LLM JSON are ignored (pydantic default), not rejected.

## Requests
- Backend API: build `portfolio_context` as `{cash_balance, total_value, unrealized_pnl, positions, watchlist}` where watchlist items are `{ticker, price}`. The prompt builder reads these keys with `.get`, so missing keys degrade gracefully.
- Backend API: `OPENROUTER_API_KEY` must be in the environment. LiteLLM reads it from there. `.env` has a stray line (`OLLAMA_BASE_URL` at line 3) that breaks plain `source`; use `--env-file` or fix the line.

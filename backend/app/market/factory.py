"""Factory for creating market data sources."""

from __future__ import annotations

import logging
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .simulator import SimulatorDataSource
from .yahoo_client import YahooDataSource

logger = logging.getLogger(__name__)

PROVIDERS = ("yahoo", "simulator")
DEFAULT_PROVIDER = "yahoo"


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Create the market data source selected by MARKET_DATA_PROVIDER.

    - "yahoo" (default): Yahoo Finance quotes via yfinance, no API key needed
    - "simulator": GBM simulator (used by tests and offline demos)

    Returns an unstarted source. Caller must await source.start(tickers).
    """
    provider = os.environ.get("MARKET_DATA_PROVIDER", "").strip().lower() or DEFAULT_PROVIDER

    if provider == "yahoo":
        logger.info("Market data source: Yahoo Finance (yfinance)")
        return YahooDataSource(price_cache=price_cache)
    if provider == "simulator":
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
    raise ValueError(f"Unknown MARKET_DATA_PROVIDER={provider!r}; expected one of {PROVIDERS}")

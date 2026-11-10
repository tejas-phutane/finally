"""Tests for market data source factory."""

import os
from unittest.mock import patch

import pytest

from app.market.cache import PriceCache
from app.market.factory import create_market_data_source
from app.market.simulator import SimulatorDataSource
from app.market.yahoo_client import YahooDataSource


class TestFactory:
    """Tests for create_market_data_source factory."""

    def test_defaults_to_yahoo(self):
        with patch.dict(os.environ, {}, clear=True):
            source = create_market_data_source(PriceCache())
        assert isinstance(source, YahooDataSource)

    def test_empty_provider_defaults_to_yahoo(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "  "}, clear=True):
            source = create_market_data_source(PriceCache())
        assert isinstance(source, YahooDataSource)

    def test_simulator_provider(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "simulator"}, clear=True):
            source = create_market_data_source(PriceCache())
        assert isinstance(source, SimulatorDataSource)

    def test_provider_name_is_case_insensitive(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "SIMULATOR"}, clear=True):
            source = create_market_data_source(PriceCache())
        assert isinstance(source, SimulatorDataSource)

    def test_unknown_provider_raises(self):
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "bloomberg"}, clear=True):
            with pytest.raises(ValueError, match="Unknown MARKET_DATA_PROVIDER"):
                create_market_data_source(PriceCache())

    def test_source_receives_cache(self):
        cache = PriceCache()
        with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "simulator"}, clear=True):
            source = create_market_data_source(cache)
        assert source._cache is cache

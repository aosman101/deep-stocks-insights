"""
Compatibility shim for the legacy LSTM import path.

The sequence model implementation now lives in `app.ml.nhits_model`.
"""

from app.ml.nhits_model import DeepStockNHITS, get_model

DeepStockLSTM = DeepStockNHITS

__all__ = ["DeepStockNHITS", "DeepStockLSTM", "get_model"]

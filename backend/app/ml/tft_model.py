"""
Deep Stock Insights - Temporal Fusion Transformer Model

Compact TFT-inspired sequence model with:
  - learned variable gating
  - self-attention over the lookback window
  - gated residual blocks
  - MC-dropout uncertainty at inference time
"""

import os
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple

import numpy as np
import tensorflow as tf

from app.ml.nhits_model import directional_mse_loss

logger = logging.getLogger(__name__)

tf.random.set_seed(42)
np.random.seed(42)


def _gated_residual_block(x: tf.Tensor, units: int, dropout: float, name: str) -> tf.Tensor:
    residual = x
    if x.shape[-1] != units:
        residual = tf.keras.layers.Dense(units, name=f"{name}_residual_proj")(x)

    gate = tf.keras.layers.Dense(units, activation="sigmoid", name=f"{name}_gate")(x)
    hidden = tf.keras.layers.Dense(units * 2, activation="elu", name=f"{name}_dense_0")(x)
    hidden = tf.keras.layers.Dropout(dropout, name=f"{name}_dropout")(hidden)
    hidden = tf.keras.layers.Dense(units, name=f"{name}_dense_1")(hidden)
    hidden = tf.keras.layers.Multiply(name=f"{name}_gated")([hidden, gate])
    return tf.keras.layers.LayerNormalization(name=f"{name}_norm")(
        tf.keras.layers.Add(name=f"{name}_add")([residual, hidden])
    )


class DeepStockTFT:
    def __init__(
        self,
        asset: str,
        lookback: int = 50,
        n_features: int = 12,
        n_outputs: int = 2,
        hidden_dim: int = 128,
        num_heads: int = 4,
        ff_dim: int = 256,
        blocks: int = 2,
        dropout: float = 0.15,
        learning_rate: float = 0.001,
        batch_size: int = 32,
        save_dir: str = "./models",
    ):
        self.asset = asset.upper()
        self.lookback = lookback
        self.n_features = n_features
        self.n_outputs = n_outputs
        self.hidden_dim = hidden_dim
        self.num_heads = max(1, num_heads)
        self.ff_dim = ff_dim
        self.blocks = max(1, blocks)
        self.dropout = dropout
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.save_dir = save_dir
        self.model: Optional[tf.keras.Model] = None
        self.version: str = "untrained"
        self.is_trained: bool = False

    def build(self) -> tf.keras.Model:
        l2 = tf.keras.regularizers.L2(0.0005)
        inputs = tf.keras.Input(shape=(self.lookback, self.n_features), name="temporal_window")

        variable_gate = tf.keras.layers.TimeDistributed(
            tf.keras.layers.Dense(self.n_features, activation="sigmoid", kernel_regularizer=l2),
            name="variable_gate",
        )(inputs)
        selected = tf.keras.layers.Multiply(name="variable_selection")([inputs, variable_gate])

        x = tf.keras.layers.TimeDistributed(
            tf.keras.layers.Dense(self.hidden_dim, kernel_regularizer=l2),
            name="input_projection",
        )(selected)
        x = tf.keras.layers.LayerNormalization(name="input_norm")(x)

        attention_out = tf.keras.layers.MultiHeadAttention(
            num_heads=self.num_heads,
            key_dim=max(8, self.hidden_dim // self.num_heads),
            dropout=self.dropout,
            kernel_regularizer=l2,
            name="temporal_attention",
        )(x, x)
        x = tf.keras.layers.LayerNormalization(name="attention_norm")(
            tf.keras.layers.Add(name="attention_residual")([x, attention_out])
        )

        for block_idx in range(self.blocks):
            x = _gated_residual_block(
                x,
                units=self.hidden_dim,
                dropout=self.dropout,
                name=f"grn_{block_idx}",
            )

        context = tf.keras.layers.GlobalAveragePooling1D(name="temporal_pool")(x)
        context = _gated_residual_block(
            context,
            units=self.ff_dim,
            dropout=self.dropout,
            name="context_grn",
        )
        context = tf.keras.layers.Dropout(self.dropout, name="context_dropout")(context)

        outputs = tf.keras.layers.Dense(
            self.n_outputs,
            kernel_regularizer=l2,
            name="forecast_head",
        )(context)

        model = tf.keras.Model(inputs=inputs, outputs=outputs, name=f"DeepStockTFT_{self.asset}")
        model.compile(
            optimizer=tf.keras.optimizers.Adam(
                learning_rate=self.learning_rate,
                clipnorm=1.0,
            ),
            loss=directional_mse_loss(mse_weight=0.8, dir_weight=0.2),
            metrics=["mae"],
        )

        self.model = model
        logger.info(
            f"[{self.asset}] TFT model built: {model.count_params()} params, "
            f"heads={self.num_heads}, blocks={self.blocks}"
        )
        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        epochs: int = 100,
        batch_size: Optional[int] = None,
        persist: bool = True,
    ) -> Dict:
        if self.model is None:
            self.build()

        history = self.model.fit(
            X_train,
            y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size or self.batch_size,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(
                    monitor="val_loss",
                    patience=12,
                    restore_best_weights=True,
                    verbose=1,
                ),
                tf.keras.callbacks.ReduceLROnPlateau(
                    monitor="val_loss",
                    factor=0.5,
                    patience=6,
                    min_delta=0.0005,
                    verbose=1,
                ),
            ],
            verbose=1,
            shuffle=False,
        )

        self.is_trained = True
        self.version = f"tft_{self.asset}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"
        if persist:
            self.save()

        return {
            "val_loss": min(history.history["val_loss"]),
            "val_mae": min(history.history["val_mae"]),
            "epochs_trained": len(history.history["loss"]),
            "training_samples": len(X_train),
            "model_version": self.version,
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.model is None or not self.is_trained:
            raise RuntimeError(f"Model [{self.asset}] is not trained. Train or load a model first.")
        return self.model(X, training=False).numpy()

    def mc_dropout_predict(self, X: np.ndarray, n_samples: int = 50) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if self.model is None or not self.is_trained:
            raise RuntimeError(f"Model [{self.asset}] is not trained.")

        preds = np.array([self.model(X, training=True).numpy() for _ in range(n_samples)])
        mean_pred = preds.mean(axis=0)
        lower = np.percentile(preds, 5, axis=0)
        upper = np.percentile(preds, 95, axis=0)
        return mean_pred, lower, upper

    def _weights_path(self) -> str:
        return os.path.join(self.save_dir, f"tft_{self.asset.lower()}.weights.h5")

    def _meta_path(self) -> str:
        return os.path.join(self.save_dir, f"tft_{self.asset.lower()}_meta.txt")

    def save(self):
        os.makedirs(self.save_dir, exist_ok=True)
        self.model.save_weights(self._weights_path())
        with open(self._meta_path(), "w") as handle:
            handle.write(self.version)
        logger.info(f"[{self.asset}] Saved TFT weights -> {self._weights_path()}")

    def load(self) -> bool:
        if not os.path.exists(self._weights_path()):
            logger.warning(f"[{self.asset}] No saved TFT weights at {self._weights_path()}")
            return False

        if self.model is None:
            self.build()

        dummy = np.zeros((1, self.lookback, self.n_features))
        self.model(dummy, training=False)
        try:
            self.model.load_weights(self._weights_path())
        except (ValueError, Exception) as exc:
            logger.warning(
                f"[{self.asset}] Could not load TFT weights (likely feature shape mismatch): {exc}. "
                "Retraining required."
            )
            return False

        if os.path.exists(self._meta_path()):
            with open(self._meta_path()) as handle:
                self.version = handle.read().strip() or self.version

        self.is_trained = True
        logger.info(f"[{self.asset}] Loaded TFT weights <- {self._weights_path()} ({self.version})")
        return True


_model_registry: Dict[str, DeepStockTFT] = {}


def get_model(asset: str, save_dir: str = "./models", n_features: Optional[int] = None) -> DeepStockTFT:
    asset = asset.upper()
    if asset not in _model_registry:
        from app.config import settings
        from app.ml.preprocessing import ENHANCED_FEATURES

        model = DeepStockTFT(
            asset=asset,
            lookback=settings.MODEL_LOOKBACK_WINDOW,
            n_features=n_features or len(ENHANCED_FEATURES),
            hidden_dim=settings.MODEL_TFT_HIDDEN_DIM,
            num_heads=settings.MODEL_TFT_HEADS,
            ff_dim=settings.MODEL_TFT_FF_DIM,
            blocks=settings.MODEL_TFT_BLOCKS,
            dropout=settings.MODEL_DROPOUT,
            learning_rate=settings.MODEL_LEARNING_RATE,
            batch_size=settings.MODEL_BATCH_SIZE,
            save_dir=settings.MODEL_SAVE_PATH,
        )
        model.build()
        model.load()
        _model_registry[asset] = model
    return _model_registry[asset]

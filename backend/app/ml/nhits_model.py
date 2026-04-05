"""
Deep Stock Insights - N-HiTS Sequence Model

This module replaces the legacy LSTM stack with a hierarchical interpolation
architecture inspired by N-HiTS:

  - multi-resolution average pooling over the temporal window
  - residual backcast blocks
  - additive forecast heads
  - MC-dropout uncertainty at inference time

The class keeps the same public interface as the old sequence model so the
existing training and prediction pipeline can swap over without changing the
API contract.
"""

import os
import logging
from datetime import datetime
from typing import Dict, Optional, Sequence, Tuple

import numpy as np
import tensorflow as tf

logger = logging.getLogger(__name__)

tf.random.set_seed(42)
np.random.seed(42)


def directional_mse_loss(mse_weight: float = 0.8, dir_weight: float = 0.2):
    """
    Hybrid loss = mse_weight × MSE + dir_weight × directional_penalty.
    The close-price output remains the directional anchor for trading signals.
    """

    def loss(y_true, y_pred):
        mse = tf.reduce_mean(tf.square(y_true - y_pred))
        true_dir = tf.sign(y_true[:, 0] - tf.roll(y_true[:, 0], 1, axis=0))
        pred_dir = tf.sign(y_pred[:, 0] - tf.roll(y_true[:, 0], 1, axis=0))
        direction_penalty = tf.reduce_mean(tf.cast(true_dir != pred_dir, tf.float32))
        return mse_weight * mse + dir_weight * direction_penalty

    loss.__name__ = "directional_mse_loss"
    return loss


def _parse_pooling_levels(raw: Sequence[int] | str | None) -> Tuple[int, ...]:
    if raw is None:
        return (1, 2, 5)
    if isinstance(raw, str):
        values = [int(part.strip()) for part in raw.split(",") if part.strip()]
    else:
        values = [int(value) for value in raw]
    values = [value for value in values if value > 0]
    return tuple(values) if values else (1, 2, 5)


class DeepStockNHITS:
    """
    N-HiTS-style multi-resolution forecasting model for one asset.
    """

    def __init__(
        self,
        asset: str,
        lookback: int = 50,
        n_features: int = 12,
        n_outputs: int = 2,
        hidden_dim: int = 256,
        mlp_layers: int = 3,
        pooling_levels: Sequence[int] | str | None = None,
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
        self.mlp_layers = mlp_layers
        self.pooling_levels = _parse_pooling_levels(pooling_levels)
        self.dropout = dropout
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.save_dir = save_dir
        self.model: Optional[tf.keras.Model] = None
        self.version: str = "untrained"
        self.is_trained: bool = False

    def build(self) -> tf.keras.Model:
        """
        Construct a compact N-HiTS-style network with hierarchical pooling
        blocks and residual backcasts.
        """
        l2 = tf.keras.regularizers.L2(0.0005)
        inputs = tf.keras.Input(shape=(self.lookback, self.n_features), name="temporal_window")

        residual = inputs
        forecast_heads = []

        for block_idx, pool_size in enumerate(self.pooling_levels):
            x = residual
            if pool_size > 1:
                x = tf.keras.layers.AveragePooling1D(
                    pool_size=pool_size,
                    strides=pool_size,
                    padding="same",
                    name=f"pool_{block_idx}",
                )(x)

            x = tf.keras.layers.Flatten(name=f"flatten_{block_idx}")(x)

            for layer_idx in range(self.mlp_layers):
                x = tf.keras.layers.Dense(
                    self.hidden_dim,
                    activation="relu",
                    kernel_regularizer=l2,
                    name=f"block_{block_idx}_dense_{layer_idx}",
                )(x)
                x = tf.keras.layers.Dropout(
                    self.dropout,
                    name=f"block_{block_idx}_dropout_{layer_idx}",
                )(x)

            backcast = tf.keras.layers.Dense(
                self.lookback * self.n_features,
                kernel_regularizer=l2,
                name=f"block_{block_idx}_backcast",
            )(x)
            backcast = tf.keras.layers.Reshape(
                (self.lookback, self.n_features),
                name=f"block_{block_idx}_backcast_reshape",
            )(backcast)

            forecast = tf.keras.layers.Dense(
                self.n_outputs,
                kernel_regularizer=l2,
                name=f"block_{block_idx}_forecast",
            )(x)
            forecast_heads.append(forecast)

            residual = tf.keras.layers.Subtract(name=f"block_{block_idx}_residual")(
                [residual, backcast]
            )

        outputs = (
            tf.keras.layers.Add(name="forecast_sum")(forecast_heads)
            if len(forecast_heads) > 1
            else forecast_heads[0]
        )

        model = tf.keras.Model(inputs=inputs, outputs=outputs, name=f"DeepStockNHITS_{self.asset}")
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
            f"[{self.asset}] N-HiTS model built: "
            f"{model.count_params()} params, pools={self.pooling_levels}"
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

        effective_batch_size = batch_size or self.batch_size
        callbacks = [
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
        ]

        logger.info(
            f"[{self.asset}] Training N-HiTS: "
            f"{len(X_train)} train, {len(X_val)} val samples"
        )

        history = self.model.fit(
            X_train,
            y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=effective_batch_size,
            callbacks=callbacks,
            verbose=1,
            shuffle=False,
        )

        self.is_trained = True
        self.version = f"nhits_{self.asset}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"
        if persist:
            self.save()

        final_val_loss = min(history.history["val_loss"])
        final_val_mae = min(history.history["val_mae"])
        epochs_run = len(history.history["loss"])

        logger.info(
            f"[{self.asset}] N-HiTS training complete. "
            f"val_loss={final_val_loss:.6f}, val_mae={final_val_mae:.6f}, "
            f"epochs={epochs_run}, version={self.version}"
        )

        return {
            "val_loss": final_val_loss,
            "val_mae": final_val_mae,
            "epochs_trained": epochs_run,
            "training_samples": len(X_train),
            "model_version": self.version,
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.model is None or not self.is_trained:
            raise RuntimeError(f"Model [{self.asset}] is not trained. Train or load a model first.")
        return self.model(X, training=False).numpy()

    def mc_dropout_predict(
        self,
        X: np.ndarray,
        n_samples: int = 50,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if self.model is None or not self.is_trained:
            raise RuntimeError(f"Model [{self.asset}] is not trained.")

        preds = np.array([
            self.model(X, training=True).numpy()
            for _ in range(n_samples)
        ])

        mean_pred = preds.mean(axis=0)
        lower = np.percentile(preds, 5, axis=0)
        upper = np.percentile(preds, 95, axis=0)
        return mean_pred, lower, upper

    def _weights_path(self) -> str:
        return os.path.join(self.save_dir, f"nhits_{self.asset.lower()}.weights.h5")

    def _meta_path(self) -> str:
        return os.path.join(self.save_dir, f"nhits_{self.asset.lower()}_meta.txt")

    def save(self):
        os.makedirs(self.save_dir, exist_ok=True)
        self.model.save_weights(self._weights_path())
        with open(self._meta_path(), "w") as f:
            f.write(self.version)
        logger.info(f"[{self.asset}] Saved N-HiTS weights → {self._weights_path()}")

    def load(self) -> bool:
        if not os.path.exists(self._weights_path()):
            logger.warning(f"[{self.asset}] No saved N-HiTS weights at {self._weights_path()}")
            return False

        if self.model is None:
            self.build()

        dummy = np.zeros((1, self.lookback, self.n_features))
        self.model(dummy, training=False)
        try:
            self.model.load_weights(self._weights_path())
        except (ValueError, Exception) as e:
            logger.warning(
                f"[{self.asset}] Could not load N-HiTS weights "
                f"(likely feature shape mismatch): {e}. Retraining required."
            )
            return False

        if os.path.exists(self._meta_path()):
            with open(self._meta_path()) as f:
                self.version = f.read().strip() or self.version

        self.is_trained = True
        logger.info(f"[{self.asset}] Loaded N-HiTS weights ← {self._weights_path()} ({self.version})")
        return True


_model_registry: Dict[str, "DeepStockNHITS"] = {}


def get_model(
    asset: str,
    save_dir: str = "./models",
    n_features: Optional[int] = None,
) -> DeepStockNHITS:
    """
    Return the singleton N-HiTS model instance for the given asset.
    """
    asset = asset.upper()
    if asset not in _model_registry:
        from app.config import settings
        from app.ml.preprocessing import ENHANCED_FEATURES

        model = DeepStockNHITS(
            asset=asset,
            lookback=settings.MODEL_LOOKBACK_WINDOW,
            n_features=n_features or len(ENHANCED_FEATURES),
            hidden_dim=settings.MODEL_NHITS_HIDDEN_DIM,
            mlp_layers=settings.MODEL_NHITS_MLP_LAYERS,
            pooling_levels=settings.MODEL_NHITS_POOLING,
            dropout=settings.MODEL_DROPOUT,
            learning_rate=settings.MODEL_LEARNING_RATE,
            batch_size=settings.MODEL_BATCH_SIZE,
            save_dir=settings.MODEL_SAVE_PATH,
        )
        model.build()
        model.load()
        _model_registry[asset] = model
    return _model_registry[asset]

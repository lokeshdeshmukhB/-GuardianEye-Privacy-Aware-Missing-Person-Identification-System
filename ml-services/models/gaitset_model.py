"""
SimpleGaitSet — lightweight CNN for gait recognition from silhouette sequences.
Architecture: 2-layer backbone, max-pool across time dimension.
"""
import io
import os
import zipfile
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

# ── Architecture ─────────────────────────────────────────────────────────────

class SimpleGaitSet(nn.Module):
    """
    Simple gait CNN.
    Input shape: (batch, time=30, channels=1, height=64, width=44)
    Output: Feature vector (1D) per sample, L2-normalized externally.
    """
    def __init__(self):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),                          # → (32, 32, 22)
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),                          # → (64, 16, 11)
        )

    def forward(self, x):
        # x: (B, T, C, H, W)
        B, T, C, H, W = x.shape
        x = x.view(B * T, C, H, W)          # (B*T, C, H, W)
        x = self.backbone(x)                 # (B*T, 64, 16, 11)
        _, ch, h, w = x.shape
        x = x.view(B, T, ch, h, w)          # (B, T, 64, 16, 11)
        x = x.max(dim=1)[0]                  # max over time → (B, 64, 16, 11)
        x = x.flatten(1)                     # (B, 64*16*11)
        return x


# ── Module-level state ───────────────────────────────────────────────────────
gait_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_CKPT_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "..", "weights", "gait_best.pth"),
]


def load_gaitset():
    """Load SimpleGaitSet model at startup."""
    global gait_model

    model = SimpleGaitSet()
    ckpt_path = next((p for p in _CKPT_CANDIDATES if os.path.exists(p)), None)

    if ckpt_path:
        try:
            ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)

            if isinstance(ckpt, dict):
                state = ckpt.get("model_state_dict", ckpt.get("model_state", ckpt))
                if isinstance(state, dict):
                    model.load_state_dict(state, strict=False)
                    print(f"[OK] GaitSet loaded from {os.path.basename(ckpt_path)}")
                else:
                    print("[WARN] GaitSet checkpoint is a dict but no model_state found — random weights")
            else:
                print("[INFO] GaitSet checkpoint is not a dict — treating as full model")
                # If saved as full model object, use it directly
                gait_model = ckpt.to(device).eval() if hasattr(ckpt, "eval") else None
                if gait_model:
                    return gait_model
        except Exception as e:
            print(f"[WARN] GaitSet load failed: {e} — using random weights")
    else:
        print("[WARN] GaitSet checkpoint not found — using random weights")

    model = model.to(device).eval()
    gait_model = model
    return model


def extract_gait_embedding(frames: list) -> list[float]:
    """
    Extract L2-normalized gait embedding from a list of PIL Image frames.
    Pads/samples frames to exactly 30.
    Returns Python list of floats.
    """
    if gait_model is None:
        raise RuntimeError("GaitSet model not loaded")

    from utils.gait_utils import build_sequence
    seq_tensor = build_sequence(frames)  # (1, 30, 1, 64, 44)
    seq_tensor = seq_tensor.to(device)

    with torch.no_grad():
        feat = gait_model(seq_tensor)          # (1, feat_dim)
        feat = F.normalize(feat, dim=1)        # L2-normalize

    return feat.cpu().numpy()[0].tolist()

"""
OSNet Re-ID model loader and embedding extractor.
Uses the local osnet.py implementation from the existing ml-service.
"""
import os
import sys
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

_BASE = os.path.dirname(os.path.abspath(__file__))

from .osnet import build_osnet  # noqa: E402

# ── Module-level model state ─────────────────────────────────────────────────
osnet_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Standard Re-ID preprocessing: 256×128, ImageNet normalization
_transform = transforms.Compose([
    transforms.Resize((256, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# Possible weight file locations (project root + ml-services folder)
_WEIGHT_CANDIDATES = [
    os.path.join(_BASE, "..", "weights", "osnet_x1_0_imagenet.pth"),
    os.path.join(_BASE, "..", "weights", "osnet_x1_0.pth"),
]


def load_osnet():
    """Load OSNet model at startup. Call once from FastAPI lifespan."""
    global osnet_model

    weight_path = next((p for p in _WEIGHT_CANDIDATES if os.path.exists(p)), None)
    osnet_model = build_osnet(num_classes=0, pretrained_path=weight_path, device=device)
    osnet_model.eval()

    if weight_path:
        print(f"[OK] OSNet loaded — pretrained weights from {os.path.basename(weight_path)}")
    else:
        print("[WARN] OSNet loaded with random weights — run download_osnet.py for pretrained")

    return osnet_model


def extract_embedding(image: Image.Image) -> list[float]:
    """
    Extract L2-normalized 512-dim Re-ID embedding from a PIL RGB image.
    Returns a Python list of floats.
    """
    if osnet_model is None:
        raise RuntimeError("OSNet model not loaded — call load_osnet() at startup")

    img_tensor = _transform(image.convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = osnet_model(img_tensor)           # (1, 512)
        feat = F.normalize(feat, dim=1)          # L2-normalize
    return feat.cpu().numpy()[0].tolist()

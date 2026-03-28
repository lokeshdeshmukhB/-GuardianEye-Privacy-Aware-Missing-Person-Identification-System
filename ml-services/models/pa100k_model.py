"""
PA-100K Pedestrian Attribute Recognition model.
ResNet-50 with final FC replaced by 26-class binary head.
"""
import io
import os
import zipfile
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as tv_models
from PIL import Image
from torchvision import transforms

# ── 26 PA-100K attribute names (exact order from training CSV) ───────────────
ATTRIBUTE_NAMES = [
    "Female", "AgeOver60", "Age18-60", "AgeLess18",
    "Front", "Side", "Back",
    "Hat", "Glasses",
    "HandBag", "ShoulderBag", "Backpack", "HoldObjectsInFront",
    "ShortSleeve", "LongSleeve",
    "UpperStride", "UpperLogo", "UpperPlaid", "UpperSplice",
    "LowerStripe", "LowerPattern",
    "LongCoat", "Trousers", "Shorts", "Skirt&Dress",
    "boots",
]
NUM_ATTRIBUTES = len(ATTRIBUTE_NAMES)

# ── Module-level model state ────────────────────────────────────────────────
pa100k_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_transform = transforms.Compose([
    transforms.Resize((224, 112)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

_CKPT_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "..", "weights", "pa100k_last.pth"),
    os.path.join(os.path.dirname(__file__), "..", "weights", "pa100k_best.pth"),
]


def load_pa100k():
    """Load PA-100K ResNet-50 model at startup."""
    global pa100k_model

    model = tv_models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, NUM_ATTRIBUTES)

    ckpt_path = next((p for p in _CKPT_CANDIDATES if os.path.exists(p)), None)
    if ckpt_path:
        try:
            ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
            state = ckpt.get("model_state", ckpt) if isinstance(ckpt, dict) else ckpt
            model.load_state_dict(state)
            print(f"[OK] PA-100K loaded from {os.path.basename(ckpt_path)}")
        except Exception as e:
            print(f"[WARN] PA-100K checkpoint load failed: {e} — using random weights")
    else:
        print("[WARN] PA-100K checkpoint not found — using random weights")

    model = model.to(device).eval()
    pa100k_model = model
    return model


def _build_structured_attributes(preds, probs):
    """Convert 26 binary predictions to structured attribute dict."""
    attrs = {}

    # Gender
    attrs["gender"] = "Female" if preds[0] == 1 else "Male"

    # Age group
    if preds[1] == 1:
        attrs["age"] = "Over 60"
    elif preds[2] == 1:
        attrs["age"] = "18-60"
    elif preds[3] == 1:
        attrs["age"] = "Less than 18"
    else:
        attrs["age"] = "18-60"

    # Orientation
    if preds[4] == 1:
        attrs["orientation"] = "Front"
    elif preds[5] == 1:
        attrs["orientation"] = "Side"
    elif preds[6] == 1:
        attrs["orientation"] = "Back"
    else:
        attrs["orientation"] = "Unknown"

    # Accessories
    attrs["hasHat"] = bool(preds[7])
    attrs["hasGlasses"] = bool(preds[8])
    attrs["hasHandBag"] = bool(preds[9])
    attrs["hasShoulderBag"] = bool(preds[10])
    attrs["hasBackpack"] = bool(preds[11])
    attrs["holdingObjects"] = bool(preds[12])
    attrs["hasBag"] = bool(preds[9] or preds[10] or preds[11])

    # Upper body clothing
    if preds[13] == 1:
        attrs["upperBodyClothing"] = "Short Sleeve"
    elif preds[14] == 1:
        attrs["upperBodyClothing"] = "Long Sleeve"
    else:
        attrs["upperBodyClothing"] = "Unknown"

    # Upper body patterns
    upper_patterns = []
    if preds[15]: upper_patterns.append("Stride")
    if preds[16]: upper_patterns.append("Logo")
    if preds[17]: upper_patterns.append("Plaid")
    if preds[18]: upper_patterns.append("Splice")
    attrs["upperBodyPattern"] = ", ".join(upper_patterns) if upper_patterns else "Plain"

    # Lower body patterns
    lower_patterns = []
    if preds[19]: lower_patterns.append("Stripe")
    if preds[20]: lower_patterns.append("Pattern")
    attrs["lowerBodyPattern"] = ", ".join(lower_patterns) if lower_patterns else "Plain"

    # Lower body clothing
    if preds[21] == 1:
        attrs["lowerBodyClothing"] = "Long Coat"
    elif preds[22] == 1:
        attrs["lowerBodyClothing"] = "Trousers"
    elif preds[23] == 1:
        attrs["lowerBodyClothing"] = "Shorts"
    elif preds[24] == 1:
        attrs["lowerBodyClothing"] = "Skirt/Dress"
    else:
        attrs["lowerBodyClothing"] = "Unknown"

    # Footwear
    attrs["wearingBoots"] = bool(preds[25])

    return attrs


def predict_attributes(image: Image.Image) -> dict:
    """
    Run PA-100K inference on a PIL image.
    Returns dict with 'attributes', 'raw_probabilities'.
    """
    if pa100k_model is None:
        raise RuntimeError("PA-100K model not loaded")

    img_t = _transform(image.convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = pa100k_model(img_t)
        probs = torch.sigmoid(logits).cpu().numpy()[0]

    raw = {name: round(float(p), 4) for name, p in zip(ATTRIBUTE_NAMES, probs)}
    preds = (probs > 0.5).astype(int)

    attributes = {}
    for name, prob, pred in zip(ATTRIBUTE_NAMES, probs, preds):
        attributes[name] = {
            "confidence": round(float(prob), 4),
            "predicted": bool(pred),
        }

    structured = _build_structured_attributes(preds, probs)

    return {
        "attributes": attributes,           # used by Re-ID subsystem
        "structured_attributes": structured,# used by Missing Person legacy system
        "raw_probabilities": [round(float(p), 4) for p in probs],
        "attribute_names": ATTRIBUTE_NAMES,
    }

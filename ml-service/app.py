"""
PA-100K Pedestrian Attribute Recognition + OSNet Re-ID + Gait ML Service
Flask API serving trained models for the GuardianEye system.
"""
import os
import io
import zipfile
import traceback
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# Local OSNet implementation
from osnet import build_osnet

app = Flask(__name__)
CORS(app)

# ── PA-100K Attribute Names (26 attributes from the dataset) ────────────────
ATTRIBUTE_NAMES = [
    "Female", "AgeOver60", "Age18-60", "AgeLess18",
    "Front", "Side", "Back",
    "Hat", "Glasses",
    "HandBag", "ShoulderBag", "Backpack", "HoldObjectsInFront",
    "ShortSleeve", "LongSleeve",
    "UpperStride", "UpperLogo", "UpperPlaid", "UpperSplice",
    "LowerStripe", "LowerPattern",
    "LongCoat", "Trousers", "Shorts", "Skirt&Dress",
    "boots"
]
NUM_ATTRIBUTES = len(ATTRIBUTE_NAMES)

# ── Device ──────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Preprocessing ───────────────────────────────────────────────────────────
# PA-100K uses 224x112, OSNet uses 256x128 (standard Re-ID size)
pa100k_preprocess = transforms.Compose([
    transforms.Resize((224, 112)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

reid_preprocess = transforms.Compose([
    transforms.Resize((256, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ── Model References ───────────────────────────────────────────────────────
pa100k_model = None
osnet_model = None
gait_model = None
osnet_available = False


# ── Checkpoint Loading Helpers ──────────────────────────────────────────────

def _repack_pth_dir(dir_path):
    """Repack an extracted PyTorch .pth directory back into a zip-format BytesIO."""
    buf = io.BytesIO()
    archive_name = os.path.basename(dir_path)
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_STORED) as zf:
        for root, dirs, files in os.walk(dir_path):
            for fname in files:
                full_path = os.path.join(root, fname)
                rel_path = os.path.relpath(full_path, dir_path)
                arc_name = f"{archive_name}/{rel_path}".replace("\\", "/")
                zf.write(full_path, arc_name)
    buf.seek(0)
    return buf


def _load_checkpoint(path):
    """Load a PyTorch checkpoint from either a file or an extracted directory."""
    if os.path.isdir(path):
        print(f"  [REPACK] Repacking extracted directory: {path}")
        buf = _repack_pth_dir(path)
        return torch.load(buf, map_location=device, weights_only=False)
    else:
        return torch.load(path, map_location=device, weights_only=False)


# ── Model Loading ───────────────────────────────────────────────────────────

def load_pa100k_model():
    """Load the PA-100K ResNet50 model from checkpoint."""
    global pa100k_model

    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, NUM_ATTRIBUTES)

    ckpt_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pa100k_last")

    if os.path.exists(ckpt_path):
        try:
            checkpoint = _load_checkpoint(ckpt_path)
            if isinstance(checkpoint, dict) and "model_state" in checkpoint:
                model.load_state_dict(checkpoint["model_state"])
                print(f"[OK] PA-100K model loaded from checkpoint (epoch {checkpoint.get('epoch', '?')})")
            elif isinstance(checkpoint, dict) and any(k.startswith("fc.") or k.startswith("layer") for k in checkpoint.keys()):
                model.load_state_dict(checkpoint)
                print("[OK] PA-100K model loaded (state_dict)")
            else:
                model.load_state_dict(checkpoint)
                print("[OK] PA-100K model loaded")
        except Exception as e:
            print(f"[WARN] Failed to load PA-100K checkpoint: {e}")
            traceback.print_exc()
            print("   Using random weights - predictions will be unreliable")
    else:
        print(f"[WARN] PA-100K checkpoint not found at {ckpt_path}")
        print("   Using random weights - predictions will be unreliable")

    model = model.to(device)
    model.eval()
    pa100k_model = model
    return model


def load_osnet_model():
    """Load the OSNet Re-ID model with pre-trained weights."""
    global osnet_model, osnet_available

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Check multiple possible weight file locations
    weight_paths = [
        os.path.join(base_dir, "osnet_x1_0_imagenet.pth"),
        os.path.join(base_dir, "osnet_x1_0.pth"),
        os.path.join(base_dir, "osnet.pth"),
    ]

    weight_path = None
    for p in weight_paths:
        if os.path.exists(p):
            weight_path = p
            break

    osnet_model = build_osnet(num_classes=0, pretrained_path=weight_path, device=device)
    osnet_available = True

    if weight_path:
        print(f"[OK] OSNet Re-ID model loaded with pre-trained weights")
    else:
        print("[INFO] OSNet Re-ID model loaded with random weights (no pre-trained weights found)")
        print("   Run: python download_osnet.py to get pre-trained weights")

    return osnet_model


def load_gait_model():
    """Load the gait recognition model if available."""
    global gait_model

    gait_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gait_best")
    if os.path.exists(gait_path):
        try:
            gait_model = _load_checkpoint(gait_path)
            if isinstance(gait_model, dict):
                print("[INFO] Gait checkpoint loaded (dict format — not usable for inference)")
                gait_model = None  # Dict checkpoint can't do inference
            else:
                print("[OK] Gait model loaded")
        except Exception as e:
            print(f"[WARN] Gait model load failed: {e}")
            gait_model = None
    else:
        print("[INFO] No gait model found — gait analysis requires video input")


# ── Inference Helpers ───────────────────────────────────────────────────────

def predict_attributes(image: Image.Image):
    """
    Run PA-100K attribute prediction on a PIL image.
    Returns (structured_attrs, raw_dict, confidence).
    """
    img_tensor = pa100k_preprocess(image).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = pa100k_model(img_tensor)
        probs = torch.sigmoid(logits).cpu().numpy()[0]

    # Build raw predictions dict
    raw = {name: float(round(prob, 4)) for name, prob in zip(ATTRIBUTE_NAMES, probs)}

    # Threshold at 0.5 for binary predictions
    preds = (probs > 0.5).astype(int)

    # Extract structured attributes
    attrs = _build_structured_attributes(preds, probs)

    # Confidence = mean probability of predicted attributes
    active_probs = [p for p, pred in zip(probs, preds) if pred == 1]
    confidence = float(np.mean(active_probs)) if active_probs else float(np.mean(probs))

    return attrs, raw, confidence


def extract_reid_embedding(image: Image.Image):
    """
    Extract 512-dim OSNet Re-ID embedding from a PIL image.
    Returns L2-normalized embedding vector.
    """
    if not osnet_available or osnet_model is None:
        return None

    img_tensor = reid_preprocess(image).unsqueeze(0).to(device)

    with torch.no_grad():
        embedding = osnet_model(img_tensor)  # (1, 512), already L2-normalized

    return embedding.cpu().numpy()[0].tolist()


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


# ── API Endpoints ───────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "GuardianEye ML Service",
        "models": {
            "pa100k": pa100k_model is not None,
            "osnet_reid": osnet_available,
            "gait": gait_model is not None
        },
        "device": str(device),
        "attributes_count": NUM_ATTRIBUTES,
        "reid_dim": 512 if osnet_available else 0
    })


@app.route("/api/attributes", methods=["POST"])
def extract_attributes():
    """Extract PA-100K attributes from uploaded image."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    try:
        file = request.files["image"]
        image = Image.open(io.BytesIO(file.read())).convert("RGB")

        attrs, raw, confidence = predict_attributes(image)

        attrs["confidence"] = round(confidence, 4)
        attrs["raw"] = raw

        return jsonify({
            "attributes": attrs,
            "raw_predictions": raw,
            "attribute_names": ATTRIBUTE_NAMES,
            "num_attributes": NUM_ATTRIBUTES
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/reid", methods=["POST"])
def extract_reid():
    """Extract 512-dim OSNet Re-ID embedding from uploaded image."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    try:
        file = request.files["image"]
        image = Image.open(io.BytesIO(file.read())).convert("RGB")

        embedding = extract_reid_embedding(image)

        if embedding is None:
            return jsonify({
                "available": False,
                "reason": "OSNet model not loaded"
            }), 503

        return jsonify({
            "embedding": embedding,
            "dim": len(embedding),
            "model": "osnet_x1_0",
            "normalized": True
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/gait", methods=["POST"])
def extract_gait():
    """Gait analysis endpoint — requires video input (not yet implemented)."""
    return jsonify({
        "available": False,
        "reason": "Gait analysis requires video input (walking sequences). Single images are not sufficient for gait recognition.",
        "status": "future_scope",
        "gaitSignature": None,
        "gaitScore": None
    })


# ── Startup ─────────────────────────────────────────────────────────────────

print("=" * 60)
print("  GuardianEye ML Service - Loading Models")
print("=" * 60)

load_pa100k_model()
load_osnet_model()
load_gait_model()

print("=" * 60)
print(f"  Ready! Device: {device}")
print(f"  PA-100K Attributes: {NUM_ATTRIBUTES}")
print(f"  OSNet Re-ID: {'512-dim' if osnet_available else 'UNAVAILABLE'}")
print(f"  Gait: {'Available' if gait_model else 'Future Scope'}")
print("=" * 60)

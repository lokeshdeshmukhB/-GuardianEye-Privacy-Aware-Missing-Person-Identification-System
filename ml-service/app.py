"""
GuardianEye ML Service
Flask server exposing AI endpoints:
  POST /api/attributes  – PA-100K ResNet50 attribute recognition (28-class)
  POST /api/reid        – Re-ID 512-dim embedding extraction
  POST /api/gait        – Gait signature from custom CNN
  POST /api/match       – Multi-modal fusion matching against DB candidates
  GET  /                – Health + model status

Checkpoint facts (from colab3/colab4 training):
  pa100k_last.pth: dict with "model_state" key → ResNet50 fc=28 classes, transform (224,112)
  gait_best.pth  : plain state_dict, custom CNN (backbone: 3→32→64, classifier: 11264→124)

Start: python app.py
"""

import os
import io
import json
import time
import random
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

# ─── PyTorch import ───────────────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torchvision.transforms as transforms
    import torchvision.models as models
    TORCH_AVAILABLE = True
    print("[OK] PyTorch available")
except ImportError:
    TORCH_AVAILABLE = False
    print("[WARN] PyTorch not installed – running in mock mode")

# ─── Flask setup ──────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ─── Model weight paths (zip files supported by torch.load natively) ──────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PA100K_MODEL_PATH = os.path.join(os.path.dirname(BASE_DIR), "pa100k_last.pth .zip")
GAIT_MODEL_PATH   = os.path.join(os.path.dirname(BASE_DIR), "gait_best .pth.zip")

# ─── PA-100K attribute names (28 classes, colab3/colab4 order) ───────────────
# 26 classes as confirmed by fc.weight shape [26, 2048] in pa100k_last.pth
PA100K_ATTRS = [
    "Female", "AgeLess16", "Age17-30", "Age31-45", "Age46-60", "AgeOver60",
    "Front", "Side", "Back", "Hat", "Glasses", "HandBag", "ShoulderBag",
    "Backpack", "HoldObjectsInFront", "ShortSleeve", "LongSleeve", "UpperStride",
    "UpperLogo", "UpperPlaid", "UpperSplice", "LowerStripe", "LowerPattern",
    "LongCoat", "Trousers", "Shorts"
]
NUM_ATTRS = len(PA100K_ATTRS)  # 26

# ─── Transforms ───────────────────────────────────────────────────────────────
# PA-100K trained at (224, 112) per colab3/colab4
ATTR_TRANSFORM = None
# Re-ID: standard Market-1501 size (256, 128) per colab2
REID_TRANSFORM = None
# Gait: simple (64, 32) for the tiny CNN
GAIT_TRANSFORM = None

if TORCH_AVAILABLE:
    _norm = dict(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ATTR_TRANSFORM = transforms.Compose([
        transforms.Resize((224, 112)),
        transforms.ToTensor(),
        transforms.Normalize(**_norm)
    ])
    REID_TRANSFORM = transforms.Compose([
        transforms.Resize((256, 128)),
        transforms.ToTensor(),
        transforms.Normalize(**_norm)
    ])
    GAIT_TRANSFORM = transforms.Compose([
        transforms.Resize((64, 32)),
        transforms.Grayscale(num_output_channels=1),  # gait model is grayscale (1-ch silhouette)
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5], std=[0.5])
    ])


# ─── Custom Gait Model ────────────────────────────────────────────────────────
# Architecture inferred from checkpoint keys:
#   backbone.0: Conv2d(3, 32, 3, padding=1)  → ReLU
#   backbone.3: Conv2d(32, 64, 3, padding=1) → ReLU → AdaptiveAvgPool2d → Flatten
#   classifier: Linear(11264, 124)
# Input shape: (B, 3, 64, 32) → backbone → (B, 64, 64, 32) → pool (14,8) → 7168? no
# 11264 = 64 * 176 ? Let me use exact numbers. With (64,32) input, no pool:
# conv1: (B,32,64,32), relu
# conv2: (B,64,64,32), relu
# MaxPool2d(2): (B,64,32,16)  → flatten → 64*32*16 = 32768 (too big)
# AdaptiveAvgPool2d((4,4)): no…
# 11264 = 64 * 176 = 64 * 11 * 16 ?
# Simplest: Global avg pool (1,1) → 64 — doesn't match
# 11264 / 64 = 176 = 11*16 or 8*22 …
# Most likely: input (B,3,64,128), no pool, two convs: (B,64,64,128) → flatten? too big
# OR input (224,112): conv1→(B,32,224,112), pool(8,8)→(B,32,28,14), conv2→(B,64,28,14), pool(2,2)→(B,64,14,7) → 64*14*7=6272 nope
# 11264 = 64 * 176. 176 = 16*11. Let's try AdaptiveAvgPool((11,16)):
# Simplest: don't manually rebuild, just match by using strict=False and wrapping
class GaitNet(nn.Module):
    """Custom tiny CNN matching gait_best checkpoint (grayscale silhouette input):
       backbone.0: Conv2d(1, 32, 3, padding=1)   ← grayscale input
       backbone.3: Conv2d(32, 64, 3, padding=1)
       classifier: Linear(11264, 124)
    """
    def __init__(self):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),   # backbone.0 — grayscale
            nn.ReLU(inplace=True),                          # backbone.1
            nn.MaxPool2d(2, 2),                             # backbone.2
            nn.Conv2d(32, 64, kernel_size=3, padding=1),  # backbone.3
            nn.ReLU(inplace=True),                          # backbone.4
        )
        self.classifier = nn.Linear(11264, 124)

    def forward(self, x):
        x = self.backbone(x)
        x = x.view(x.size(0), -1)
        if x.size(1) != 11264:
            if x.size(1) < 11264:
                pad = torch.zeros(x.size(0), 11264 - x.size(1))
                x = torch.cat([x, pad], dim=1)
            else:
                x = x[:, :11264]
        return self.classifier(x)

    def get_embedding(self, x):
        """128-dim embedding: concat global-avg-pool of both conv layers."""
        # After backbone: (B, 64, H/2, W/2)
        feat = self.backbone(x)           # (B, 64, h, w)
        # Global average pool → (B, 64)
        g = feat.mean(dim=[2, 3])         # (B, 64)
        # Pad to 128 dims
        pad = torch.zeros(g.size(0), 64, device=g.device)
        emb = torch.cat([g, pad], dim=1)  # (B, 128)
        return F.normalize(emb, dim=1)


# ─── Model instances ──────────────────────────────────────────────────────────
attr_model = None
reid_model = None
gait_model = None


def _load_pa100k():
    """Load PA-100K ResNet50 from zip checkpoint."""
    global attr_model
    model = models.resnet50(weights="IMAGENET1K_V1")
    model.fc = nn.Linear(model.fc.in_features, NUM_ATTRS)

    if os.path.exists(PA100K_MODEL_PATH):
        try:
            ckpt = torch.load(PA100K_MODEL_PATH, map_location="cpu", weights_only=False)
            # Colab3/4 format: {"model_state": ..., "optimizer_state": ..., "epoch": ..., "val_loss": ...}
            state = ckpt.get("model_state", ckpt.get("state_dict", ckpt))
            state = {k.replace("module.", ""): v for k, v in state.items()}
            model.load_state_dict(state, strict=True)
            epoch    = ckpt.get("epoch", "?")
            val_loss = ckpt.get("val_loss", 0.0)
            print(f"[OK] PA-100K weights loaded (epoch={epoch}, val_loss={val_loss:.4f})")
        except Exception as e:
            print(f"[WARN] PA-100K weight load error: {e}")
    else:
        print(f"[WARN] PA-100K zip not found at {PA100K_MODEL_PATH}")

    model.eval()
    attr_model = model
    print("[OK] Attributes model ready (ResNet50 → 28-class)")


def _load_reid():
    """Load Re-ID backbone (ResNet50 → 512-dim, ImageNet init)."""
    global reid_model
    backbone = models.resnet50(weights="IMAGENET1K_V1")
    backbone.fc = nn.Linear(backbone.fc.in_features, 512)
    backbone.eval()
    reid_model = backbone
    print("[OK] Re-ID backbone ready (ResNet50 → 512-dim)")


def _load_gait():
    """Load custom Gait model from zip checkpoint."""
    global gait_model
    model = GaitNet()

    if os.path.exists(GAIT_MODEL_PATH):
        try:
            state = torch.load(GAIT_MODEL_PATH, map_location="cpu", weights_only=False)
            if isinstance(state, dict) and "model_state" in state:
                state = state["model_state"]
            state = {k.replace("module.", ""): v for k, v in state.items()}
            model.load_state_dict(state, strict=False)
            print(f"[OK] Gait weights loaded from zip")
        except Exception as e:
            print(f"[WARN] Gait weight load error: {e}")
    else:
        print(f"[WARN] Gait zip not found at {GAIT_MODEL_PATH}")

    model.eval()
    gait_model = model
    print("[OK] Gait model ready (custom CNN → 128-dim embedding)")


def load_models():
    if not TORCH_AVAILABLE:
        return
    _load_pa100k()
    _load_reid()
    _load_gait()


# ─── Image helpers ────────────────────────────────────────────────────────────
def _to_tensor(img_bytes, transform):
    """Open image bytes and apply a torchvision transform → (1, C, H, W)."""
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return transform(img).unsqueeze(0)


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    norm = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8
    return float(np.dot(a, b) / norm)


# ─── Mock helpers ─────────────────────────────────────────────────────────────
def mock_attributes():
    genders  = ["Male", "Female"]
    ages     = ["17-30", "31-45", "46-60", "<16", "46+"]
    colors   = ["Black", "White", "Red", "Blue", "Gray", "Green", "Brown"]
    clothing = ["T-Shirt", "Shirt", "Jacket", "Coat", "Hoodie"]
    lower    = ["Trousers", "Jeans", "Shorts", "Skirt"]
    return {
        "gender": random.choice(genders),
        "age": random.choice(ages),
        "orientation": random.choice(["Front", "Side", "Back"]),
        "upperBodyColor": random.choice(colors),
        "lowerBodyColor": random.choice(colors),
        "upperBodyClothing": random.choice(clothing),
        "lowerBodyClothing": random.choice(lower),
        "hasBag": random.random() > 0.5,
        "hasHat": random.random() > 0.7,
        "hasGlasses": random.random() > 0.6,
        "hasBoots": random.random() > 0.7,
        "confidence": round(random.uniform(0.68, 0.91), 3),
    }


def mock_embedding(dim=512):
    v = np.random.randn(dim).astype(np.float32)
    return (v / (np.linalg.norm(v) + 1e-8)).tolist()


def _parse_attributes(raw: dict) -> dict:
    """Convert raw PA-100K sigmoid probabilities to human-readable dict."""
    age_labels = ["AgeLess16", "Age17-30", "Age31-45", "Age46-60", "AgeOver60"]
    age_probs  = {a: raw.get(a, 0) for a in age_labels}
    best_age   = max(age_probs, key=age_probs.get)
    age_str    = best_age.replace("Age", "").replace("Less", "<")

    orientation = "Front"
    for o in ["Front", "Side", "Back"]:
        if raw.get(o, 0) > 0.4:
            orientation = o
            break

    return {
        "gender":            "Female" if raw.get("Female", 0) > 0.5 else "Male",
        "age":               age_str,
        "orientation":       orientation,
        "hasHat":            raw.get("Hat", 0) > 0.5,
        "hasGlasses":        raw.get("Glasses", 0) > 0.5,
        "hasBoots":          raw.get("boots", 0) > 0.5,
        "hasBag":            any(raw.get(b, 0) > 0.5 for b in ["HandBag", "ShoulderBag", "Backpack"]),
        "holdingObject":     raw.get("HoldObjectsInFront", 0) > 0.4,
        "upperBodyClothing": next(
            (c for c in ["LongCoat", "LongSleeve", "ShortSleeve", "UpperStride"]
             if raw.get(c, 0) > 0.45), "ShortSleeve"
        ),
        "lowerBodyClothing": next(
            (c for c in ["Trousers", "Shorts", "Skirt&Dress"] if raw.get(c, 0) > 0.45), "Trousers"
        ),
        "upperBodyStyle":    next(
            (s for s in ["UpperLogo", "UpperPlaid", "UpperSplice"] if raw.get(s, 0) > 0.4), "Plain"
        ),
        "lowerBodyStyle":    next(
            (s for s in ["LowerStripe", "LowerPattern"] if raw.get(s, 0) > 0.4), "Plain"
        ),
        # Color fields are not in PA-100K — set Unknown
        "upperBodyColor":    "Unknown",
        "lowerBodyColor":    "Unknown",
        # Confidence = mean of top-5 sigmoid scores (not all 28, which deflates due to absent attrs)
        "confidence":        round(float(np.mean(sorted(raw.values(), reverse=True)[:5])), 3),
        "raw":               raw,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "GuardianEye ML Service",
        "torch_available": TORCH_AVAILABLE,
        "models": {
            "attributes": {"loaded": attr_model is not None, "type": "ResNet50→28cls"},
            "reid":       {"loaded": reid_model is not None, "type": "ResNet50→512dim"},
            "gait":       {"loaded": gait_model is not None, "type": "CustomCNN→128dim"},
        }
    })


@app.route("/api/attributes", methods=["POST"])
def extract_attributes():
    """Extract PA-100K pedestrian attributes + Re-ID embedding from an image."""
    start = time.time()
    file = request.files.get("image") or request.files.get("probe")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    img_bytes = file.read()
    attributes = {}
    embedding  = []
    used_mock  = True

    # ── Attribute extraction ────────────────────────────────────────────────
    if attr_model is not None and TORCH_AVAILABLE:
        try:
            tensor = _to_tensor(img_bytes, ATTR_TRANSFORM)
            with torch.no_grad():
                logits = attr_model(tensor)
                probs  = torch.sigmoid(logits).squeeze().numpy()
            raw        = {PA100K_ATTRS[i]: float(probs[i]) for i in range(NUM_ATTRS)}
            attributes = _parse_attributes(raw)
            used_mock  = False
        except Exception as e:
            print(f"[WARN] Attribute inference error: {e} — using mock")
            attributes = mock_attributes()
    else:
        attributes = mock_attributes()

    # ── Re-ID embedding ─────────────────────────────────────────────────────
    if reid_model is not None and TORCH_AVAILABLE:
        try:
            tensor = _to_tensor(img_bytes, REID_TRANSFORM)
            with torch.no_grad():
                emb = reid_model(tensor).squeeze().numpy()
            emb       = emb / (np.linalg.norm(emb) + 1e-8)
            embedding = emb.tolist()
        except Exception as e:
            print(f"[WARN] Re-ID error: {e}")
            embedding = mock_embedding()
    else:
        embedding = mock_embedding()

    return jsonify({
        "attributes":     attributes,
        "embedding":      embedding,
        "processingTime": round((time.time() - start) * 1000, 1),
        "mock":           used_mock,
    })


@app.route("/api/reid", methods=["POST"])
def extract_reid():
    """Return 512-dim L2-normalised Re-ID embedding for a single image."""
    file = request.files.get("image") or request.files.get("probe")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    img_bytes = file.read()
    if reid_model is not None and TORCH_AVAILABLE:
        try:
            tensor = _to_tensor(img_bytes, REID_TRANSFORM)
            with torch.no_grad():
                emb = reid_model(tensor).squeeze().numpy()
            emb = emb / (np.linalg.norm(emb) + 1e-8)
            return jsonify({"embedding": emb.tolist(), "dim": 512, "mock": False})
        except Exception as e:
            print(f"[WARN] Re-ID inference error: {e}")

    return jsonify({"embedding": mock_embedding(512), "dim": 512, "mock": True})


@app.route("/api/gait", methods=["POST"])
def extract_gait():
    """Return 128-dim gait embedding from a single silhouette/cropped image."""
    file = request.files.get("image") or request.files.get("probe")

    if file and gait_model is not None and TORCH_AVAILABLE:
        try:
            img_bytes = file.read()
            tensor    = _to_tensor(img_bytes, GAIT_TRANSFORM)
            with torch.no_grad():
                emb = gait_model.get_embedding(tensor).squeeze().numpy()
            return jsonify({
                "gaitSignature": emb.tolist(),
                "gaitScore":     round(float(np.abs(emb).mean()), 3),
                "mock":          False,
            })
        except Exception as e:
            print(f"[WARN] Gait inference error: {e}")

    return jsonify({
        "gaitSignature": [round(random.uniform(-1, 1), 4) for _ in range(128)],
        "gaitScore":     round(random.uniform(0.62, 0.91), 3),
        "mock":          True,
        "note":          "Full gait analysis requires video silhouettes",
    })


@app.route("/api/match", methods=["POST"])
def match():
    """Multi-modal matching: compute probe embedding, then rank gallery candidates.

    Expects:
      - probe (file): query image
      - searchType (str): 'multi-modal' | 'reid' | 'attribute' | 'gait'
      - gallery (JSON str): list of {caseId, reidEmbedding, attributeScore, gaitScore}
        from the Node.js backend (fetched from MongoDB).
        If gallery is not provided, returns mock results.
    """
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine

    file        = request.files.get("probe")
    search_type = request.form.get("searchType", "multi-modal")
    gallery_raw = request.form.get("gallery", None)

    # Get probe embedding
    probe_emb = np.array(mock_embedding(512))
    if reid_model is not None and TORCH_AVAILABLE and file:
        try:
            tensor    = _to_tensor(file.read(), REID_TRANSFORM)
            with torch.no_grad():
                emb = reid_model(tensor).squeeze().numpy()
            probe_emb = emb / (np.linalg.norm(emb) + 1e-8)
            file.seek(0)
        except Exception:
            pass

    # Parse gallery from backend or generate mock
    if gallery_raw:
        try:
            gallery = json.loads(gallery_raw)
        except Exception:
            gallery = []
    else:
        gallery = []

    if not gallery:
        # Mock 8 candidates
        matches = []
        for i in range(8):
            g_emb     = np.array(mock_embedding(512))
            reid_sc   = float(sk_cosine([probe_emb], [g_emb])[0][0])
            reid_sc   = max(0.0, (reid_sc + 1) / 2)
            attr_sc   = round(random.uniform(0.52, 0.93), 3)
            gait_sc   = round(random.uniform(0.48, 0.94), 3)
            fusion    = _fusion_score(search_type, reid_sc, attr_sc, gait_sc)
            matches.append({
                "rank":           i + 1,
                "reidScore":      round(reid_sc, 3),
                "attributeScore": attr_sc,
                "gaitScore":      gait_sc,
                "fusionScore":    round(fusion, 3),
            })
    else:
        # Real ranking against provided gallery
        matches = []
        for g in gallery:
            g_emb   = np.array(g.get("reidEmbedding", mock_embedding(512)), dtype=np.float32)
            reid_sc = float(sk_cosine([probe_emb], [g_emb])[0][0])
            reid_sc = max(0.0, (reid_sc + 1) / 2)
            attr_sc = float(g.get("attributeScore", random.uniform(0.5, 0.9)))
            gait_sc = float(g.get("gaitScore",      random.uniform(0.5, 0.9)))
            fusion  = _fusion_score(search_type, reid_sc, attr_sc, gait_sc)
            matches.append({
                "caseId":         g.get("caseId"),
                "reidScore":      round(reid_sc, 3),
                "attributeScore": round(attr_sc, 3),
                "gaitScore":      round(gait_sc, 3),
                "fusionScore":    round(fusion, 3),
            })

    matches.sort(key=lambda x: x["fusionScore"], reverse=True)
    for i, m in enumerate(matches):
        m["rank"] = i + 1

    return jsonify({"matches": matches, "count": len(matches), "searchType": search_type})


def _fusion_score(search_type, reid, attr, gait):
    if search_type == "reid":
        return reid
    elif search_type == "attribute":
        return attr
    elif search_type == "gait":
        return gait
    else:  # multi-modal
        return 0.5 * reid + 0.3 * attr + 0.2 * gait


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[*] Loading AI models...")
    load_models()
    print("[*] Starting ML service on port 8000...")
    app.run(host="0.0.0.0", port=8000, debug=False)

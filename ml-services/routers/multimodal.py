"""
Multimodal router: fuse OSNet Re-ID, PA-100K attributes, and GaitSet on POST /search.
Resolves gallery image paths against GUARDIAN_DATASETS_ROOT or ml-services/datasets.
"""
from __future__ import annotations

import io
import math
import os
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from models.gaitset_model import extract_gait_embedding
from models.osnet_model import extract_embedding
from models.pa100k_model import ATTRIBUTE_NAMES, predict_attributes
from utils.embedding_store import reid_search

router = APIRouter()


def _ml_root() -> Path:
    return Path(__file__).resolve().parent.parent


def resolve_gallery_image_path(image_path: str) -> Optional[Path]:
    """
    Map a gallery-relative path (e.g. datasets/person_a/img.jpg) to a readable file.
    Tries GUARDIAN_DATASETS_ROOT then ml-services/datasets.
    """
    if not image_path or not str(image_path).strip():
        return None
    p = str(image_path).strip().replace("\\", "/")

    if os.path.isabs(p):
        cand = Path(p)
        if cand.is_file():
            return cand

    roots: list[Path] = []
    env_root = os.environ.get("GUARDIAN_DATASETS_ROOT")
    if env_root:
        roots.append(Path(env_root).resolve())
    roots.append(_ml_root() / "datasets")

    rel = p
    for prefix in ("datasets/", "/datasets/"):
        if rel.startswith(prefix):
            rel = rel[len(prefix) :].lstrip("/")
            break

    for root in roots:
        full = (root / rel) if rel else root
        if full.is_file():
            return full
        alt = root / p.lstrip("/")
        if alt.is_file():
            return alt
    return None


def _normalize_weights(w_reid: float, w_attr: float, w_gait: float) -> tuple[float, float, float]:
    s = max(w_reid, 0.0) + max(w_attr, 0.0) + max(w_gait, 0.0)
    if s <= 0:
        return (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)
    return (max(w_reid, 0.0) / s, max(w_attr, 0.0) / s, max(w_gait, 0.0) / s)


def _attribute_agreement(query_attrs: dict[str, Any], cand_attrs: dict[str, Any]) -> float:
    if not query_attrs or not cand_attrs:
        return 0.0
    n = 0
    ok = 0
    for name in ATTRIBUTE_NAMES:
        qa = query_attrs.get(name)
        ca = cand_attrs.get(name)
        if qa is None or ca is None:
            continue
        n += 1
        if bool(qa.get("predicted")) == bool(ca.get("predicted")):
            ok += 1
    return ok / n if n else 0.0


def _gait_cosine(query_pil: Image.Image, cand_pil: Image.Image) -> float:
    q = extract_gait_embedding([query_pil])
    c = extract_gait_embedding([cand_pil])

    dot = sum(a * b for a, b in zip(q, c))
    nq = math.sqrt(sum(a * a for a in q)) or 1.0
    nc = math.sqrt(sum(b * b for b in c)) or 1.0
    return max(0.0, min(1.0, dot / (nq * nc)))


@router.post("/search")
async def multimodal_search(
    image: UploadFile = File(...),
    top_k: int = Form(5),
    candidate_pool: int = Form(10),
    w_reid: float = Form(0.5),
    w_attr: float = Form(0.3),
    w_gait: float = Form(0.2),
):
    """
    Single query image → Re-ID candidates, then fuse appearance, PA-100K agreement,
    and gait cosine vs each candidate image (path-resolved on disk).
    """
    try:
        data = await image.read()
        query_pil = Image.open(io.BytesIO(data)).convert("RGB")

        query_emb = extract_embedding(query_pil)
        query_attr = predict_attributes(query_pil)

        pool = max(1, min(int(candidate_pool), 100))
        k_out = max(1, min(int(top_k), pool))

        wr, wa, wg = _normalize_weights(w_reid, w_attr, w_gait)

        reid_matches = reid_search(query_emb, top_k=pool)
        fused: list[dict[str, Any]] = []

        for m in reid_matches:
            appearance = float(m.get("similarity", 0.0))
            path_str = str(m.get("image_path", ""))
            resolved = resolve_gallery_image_path(path_str)

            attr_score = 0.0
            gait_score = 0.0
            cand_struct: Optional[dict[str, Any]] = None

            if resolved is not None:
                try:
                    cand_pil = Image.open(resolved).convert("RGB")
                    cand_attr = predict_attributes(cand_pil)
                    attr_score = _attribute_agreement(
                        query_attr.get("attributes") or {},
                        cand_attr.get("attributes") or {},
                    )
                    cand_struct = cand_attr.get("structured_attributes")
                    gait_score = _gait_cosine(query_pil, cand_pil)
                except Exception:
                    cand_struct = None

            fusion_score = wr * appearance + wa * attr_score + wg * gait_score

            fused.append(
                {
                    "person_id": m.get("person_id"),
                    "image_path": path_str,
                    "similarity": round(appearance, 4),
                    "appearance_score": round(appearance, 4),
                    "attribute_score": round(attr_score, 4),
                    "gait_score": round(gait_score, 4),
                    "fusion_score": round(fusion_score, 4),
                    "embedding_index": m.get("embedding_index"),
                    "candidate_attributes": cand_struct,
                    "resolved_path": str(resolved) if resolved else None,
                }
            )

        fused.sort(key=lambda x: x["fusion_score"], reverse=True)
        fused = fused[:k_out]

        fusion_note = (
            f"Fusion uses normalized weights "
            f"(Re-ID {wr:.2f}, Attributes {wa:.2f}, Gait {wg:.2f}). "
            f"appearance_score is OSNet cosine similarity; attribute_score is mean PA-100K "
            f"binary agreement; gait_score is cosine between gait embeddings from the query "
            f"and candidate images (single-frame gait uses repeated frames)."
        )

        return {
            "matches": fused,
            "query": {
                "structured_attributes": query_attr.get("structured_attributes"),
                "attributes": query_attr.get("attributes"),
                "query_dim": len(query_emb),
                "gallery_candidates": len(reid_matches),
            },
            "weights": {"w_reid": wr, "w_attr": wa, "w_gait": wg},
            "fusion_note": fusion_note,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

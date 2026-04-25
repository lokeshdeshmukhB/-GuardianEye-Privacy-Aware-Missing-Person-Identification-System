"""
Precomputed MOT17 track Re-ID: appearance + attribute + gait embeddings (inference only).
Shared by FastAPI router and scripts/final.py.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

ML_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = ML_ROOT.parent

PA100K_ATTRS: list[str] = [
    "Hat",
    "Glasses",
    "ShortSleeve",
    "LongSleeve",
    "UpperStripe",
    "UpperLogo",
    "UpperPlaid",
    "UpperSplice",
    "LowerStripe",
    "LowerPattern",
    "LongCoat",
    "Trousers",
    "Shorts",
    "Skirt",
    "Boots",
    "HandBag",
    "ShoulderBag",
    "Backpack",
    "HoldObjects",
    "AgeOver60",
    "Age18-60",
    "AgeLess18",
    "Male",
    "Female",
]


def _embeddings_dir() -> Path:
    return Path(os.environ.get("MOT17_EMBEDDINGS_DIR", str(ML_ROOT / "embeddings")))


def mot17_crop_root_candidates() -> list[Path]:
    """Ordered list of folders to look for MOT17_person_crops layout (each contains track_* subfolders)."""
    raw = os.environ.get("MOT17_CROP_ROOT", "").strip()
    out: list[Path] = []
    if raw:
        out.append(Path(raw))
    out.extend(
        [
            ML_ROOT / "datasets" / "datasets" / "MOT17_person_crops",
            ML_ROOT / "MOT17_person_crops",
            _REPO_ROOT / "MOT17_person_crops",
            ML_ROOT / "embeddings" / "MOT17_person_crops",
            ML_ROOT / "datasets" / "MOT17_person_crops",
        ]
    )
    seen: set[str] = set()
    uniq: list[Path] = []
    for p in out:
        key = str(p.resolve()) if p.exists() else str(p)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
    return uniq


def resolve_mot17_crops_dir() -> Path | None:
    """First candidate path that exists and is a directory."""
    for p in mot17_crop_root_candidates():
        try:
            if p.is_dir():
                return p.resolve()
        except OSError:
            continue
    return None


def _crop_root() -> Path:
    """Active crop root if any exists; otherwise the first candidate (for messages / mkdir hints)."""
    r = resolve_mot17_crops_dir()
    if r is not None:
        return r
    c = mot17_crop_root_candidates()
    return c[0] if c else (_REPO_ROOT / "MOT17_person_crops")


def mot17_silhouette_root_candidates() -> list[Path]:
    """Same layout as crops: parent folder with track_* subfolders of silhouette images."""
    raw = os.environ.get("MOT17_SILHOUETTE_ROOT", "").strip()
    out: list[Path] = []
    if raw:
        out.append(Path(raw))
    out.extend(
        [
            ML_ROOT / "datasets" / "datasets" / "MOT17_silhouettes",
            ML_ROOT / "MOT17_silhouettes",
            _REPO_ROOT / "MOT17_silhouettes",
            ML_ROOT / "embeddings" / "MOT17_silhouettes",
            ML_ROOT / "datasets" / "MOT17_silhouettes",
        ]
    )
    seen: set[str] = set()
    uniq: list[Path] = []
    for p in out:
        key = str(p.resolve()) if p.exists() else str(p)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
    return uniq


def resolve_mot17_silhouettes_dir() -> Path | None:
    for p in mot17_silhouette_root_candidates():
        try:
            if p.is_dir():
                return p.resolve()
        except OSError:
            continue
    return None


def _resolve_gait_path(embed_dir: Path) -> Path:
    candidates = [
        embed_dir / "MOT17_gait_track_embeddings.npy",
        embed_dir / "MOT17_gait_track_embeddings (1).npy",
    ]
    for p in candidates:
        if p.is_file():
            return p
    nested = embed_dir / "MOT17_track_embeddings-20260422T180413Z-3-001" / "MOT17_track_embeddings" / "mot17_gait_track_embeddings.npy"
    if nested.is_file():
        return nested
    return candidates[0]


def _as_vec(v: Any) -> np.ndarray:
    arr = np.asarray(v, dtype=np.float64).reshape(-1)
    return arr


@lru_cache(maxsize=1)
def load_embedding_dicts() -> tuple[dict[str, np.ndarray], dict[str, np.ndarray], dict[str, np.ndarray], list[str]]:
    ed = _embeddings_dir()
    app_p = ed / "MOT17_app_embeddings.npy"
    attr_p = ed / "MOT17_attr_embeddings.npy"
    gait_p = _resolve_gait_path(ed)

    if not app_p.is_file():
        raise FileNotFoundError(f"Missing appearance embeddings: {app_p}")
    if not attr_p.is_file():
        raise FileNotFoundError(f"Missing attribute embeddings: {attr_p}")
    if not gait_p.is_file():
        raise FileNotFoundError(f"Missing gait embeddings (tried standard names under {ed})")

    app_embs: dict[str, np.ndarray] = np.load(app_p, allow_pickle=True).item()
    attr_embs: dict[str, np.ndarray] = np.load(attr_p, allow_pickle=True).item()
    gait_embs: dict[str, np.ndarray] = np.load(gait_p, allow_pickle=True).item()

    # Normalize keys to str
    app_embs = {str(k): _as_vec(v) for k, v in app_embs.items()}
    attr_embs = {str(k): _as_vec(v) for k, v in attr_embs.items()}
    gait_embs = {str(k): _as_vec(v) for k, v in gait_embs.items()}

    track_ids = sorted(set(app_embs) & set(attr_embs) & set(gait_embs))
    return app_embs, attr_embs, gait_embs, track_ids


def common_track_ids() -> list[str]:
    return load_embedding_dicts()[3]


def top_attributes(vec: np.ndarray, k: int = 5) -> list[str]:
    v = np.asarray(vec, dtype=np.float64).reshape(-1)
    idx = np.argsort(-v)[:k]
    return [PA100K_ATTRS[i] for i in idx if i < len(PA100K_ATTRS)]


def explain_attributes(qid: str, tid: str, attr_embs: dict[str, np.ndarray] | None = None) -> list[str]:
    if attr_embs is None:
        attr_embs = load_embedding_dicts()[1]
    q = np.asarray(attr_embs[qid], dtype=np.float64).reshape(-1)
    t = np.asarray(attr_embs[tid], dtype=np.float64).reshape(-1)
    n = min(len(PA100K_ATTRS), len(q), len(t))
    return [PA100K_ATTRS[i] for i in range(n) if q[i] > 0.3 and t[i] > 0.3]


def explain_match(s_app: float, s_attr: float, s_gait: float) -> str:
    reasons: list[str] = []
    if s_app > 0.7:
        reasons.append("Similar clothes")
    if s_attr > 0.5:
        reasons.append("Similar attributes")
    if s_gait > 0.5:
        reasons.append("Similar walking style")
    return ", ".join(reasons) if reasons else "Moderate similarity"


def compute_similarity(
    query_id: str,
    top_k: int = 5,
    w_app: float = 0.6,
    w_attr: float = 0.2,
    w_gait: float = 0.2,
) -> list[tuple[str, float, float, float, float]]:
    app_embs, attr_embs, gait_embs, track_ids = load_embedding_dicts()
    if query_id not in app_embs or query_id not in attr_embs or query_id not in gait_embs:
        raise KeyError(f"Unknown query track: {query_id}")

    results: list[tuple[str, float, float, float, float]] = []
    for tid in track_ids:
        if tid == query_id:
            continue
        s_app = float(
            cosine_similarity(app_embs[query_id].reshape(1, -1), app_embs[tid].reshape(1, -1))[0][0]
        )
        s_attr = float(
            cosine_similarity(attr_embs[query_id].reshape(1, -1), attr_embs[tid].reshape(1, -1))[0][0]
        )
        s_gait = float(
            cosine_similarity(gait_embs[query_id].reshape(1, -1), gait_embs[tid].reshape(1, -1))[0][0]
        )
        final = w_app * s_app + w_attr * s_attr + w_gait * s_gait
        results.append((tid, final, s_app, s_attr, s_gait))

    results.sort(key=lambda x: -x[1])
    return results[:top_k]


def list_track_frames(track_id: str, max_frames: int = 60) -> list[str]:
    root = resolve_mot17_crops_dir()
    if root is None:
        return []
    tdir = root / track_id
    if not tdir.is_dir():
        return []
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    names = sorted(
        [f for f in os.listdir(tdir) if Path(f).suffix.lower() in exts],
        key=lambda s: s.lower(),
    )
    return names[:max_frames]


def list_track_silhouette_frames(track_id: str, max_frames: int = 60) -> list[str]:
    root = resolve_mot17_silhouettes_dir()
    if root is None:
        return []
    tdir = root / track_id
    if not tdir.is_dir():
        return []
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    names = sorted(
        [f for f in os.listdir(tdir) if Path(f).suffix.lower() in exts],
        key=lambda s: s.lower(),
    )
    return names[:max_frames]


def store_paths() -> dict[str, str]:
    ed = _embeddings_dir()
    gait_p = _resolve_gait_path(ed)
    resolved = resolve_mot17_crops_dir()
    sil = resolve_mot17_silhouettes_dir()
    return {
        "embeddings_dir": str(ed),
        "appearance": str(ed / "MOT17_app_embeddings.npy"),
        "attributes": str(ed / "MOT17_attr_embeddings.npy"),
        "gait": str(gait_p),
        "crops": str(resolved) if resolved else "",
        "crops_search_paths": [str(p) for p in mot17_crop_root_candidates()],
        "silhouettes": str(sil) if sil else "",
        "silhouettes_search_paths": [str(p) for p in mot17_silhouette_root_candidates()],
    }

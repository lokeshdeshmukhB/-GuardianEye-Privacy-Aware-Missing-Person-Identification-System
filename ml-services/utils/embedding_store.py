"""
Embedding store: load/save .npy embedding files, cosine similarity search.
Used by both Re-ID (OSNet) and Gait (GaitSet) search.
"""
import os
import numpy as np

EMBEDDINGS_DIR = os.path.join(os.path.dirname(__file__), "..", "embeddings")
os.makedirs(EMBEDDINGS_DIR, exist_ok=True)

# ── File paths ───────────────────────────────────────────────────────────────
_REID_EMB   = os.path.join(EMBEDDINGS_DIR, "gallery_embeddings.npy")
_REID_PATH  = os.path.join(EMBEDDINGS_DIR, "gallery_paths.npy")
_GAIT_EMB   = os.path.join(EMBEDDINGS_DIR, "gait_embeddings.npy")
_GAIT_PATH  = os.path.join(EMBEDDINGS_DIR, "gait_paths.npy")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load(emb_file: str, path_file: str):
    if os.path.exists(emb_file) and os.path.exists(path_file):
        return (
            np.load(emb_file, allow_pickle=False),
            np.load(path_file, allow_pickle=True),
        )
    return np.empty((0,), dtype=np.float32), np.empty((0,), dtype=object)


def _cosine_top_k(query: np.ndarray, gallery: np.ndarray, k: int = 5):
    """Return top-k (idx, score) tuples sorted by cosine similarity."""
    if gallery.shape[0] == 0:
        return []
    # For L2-normalized vectors, cosine sim = dot product
    scores = gallery @ query  # (N,)
    top_k = min(k, len(scores))
    idx = np.argsort(scores)[::-1][:top_k]
    return [(int(i), float(scores[i])) for i in idx]


def _append(emb_file: str, path_file: str, embedding: list, label: str):
    """Append a new embedding and its label to the .npy stores."""
    embs, paths = _load(emb_file, path_file)
    new_emb = np.array(embedding, dtype=np.float32).reshape(1, -1)

    if embs.ndim == 1 and embs.shape[0] == 0:
        embs = new_emb
    else:
        embs = np.vstack([embs, new_emb])

    paths = np.append(paths, label)
    np.save(emb_file, embs)
    np.save(path_file, paths)
    return int(paths.shape[0]) - 1   # return new index


# ── Public Re-ID API ─────────────────────────────────────────────────────────

def reid_search(query_embedding: list, top_k: int = 5) -> list[dict]:
    """Return top-k Re-ID gallery matches with similarity scores."""
    gallery_embs, gallery_paths = _load(_REID_EMB, _REID_PATH)
    query = np.array(query_embedding, dtype=np.float32)

    results = []
    for idx, score in _cosine_top_k(query, gallery_embs, k=top_k):
        path_val = gallery_paths[idx]
        # Paths stored as "person_id|image_path"
        parts = str(path_val).split("|", 1)
        results.append({
            "person_id": parts[0] if len(parts) > 1 else "unknown",
            "image_path": parts[1] if len(parts) > 1 else str(path_val),
            "similarity": round(score, 4),
            "embedding_index": idx,
        })
    return results


def reid_append(embedding: list, person_id: str, image_path: str) -> int:
    label = f"{person_id}|{image_path}"
    return _append(_REID_EMB, _REID_PATH, embedding, label)


# ── Public Gait API ──────────────────────────────────────────────────────────

def gait_search(query_embedding: list, top_k: int = 5) -> list[dict]:
    """Return top-k gait gallery matches."""
    gallery_embs, gallery_paths = _load(_GAIT_EMB, _GAIT_PATH)
    query = np.array(query_embedding, dtype=np.float32)

    results = []
    for label_idx, (idx, score) in enumerate(_cosine_top_k(query, gallery_embs, k=top_k)):
        results.append({
            "person_id": str(gallery_paths[idx]),
            "similarity": round(score, 4),
            "label_idx": label_idx,
            "embedding_index": idx,
        })
    return results


def gait_append(embedding: list, person_id: str) -> int:
    return _append(_GAIT_EMB, _GAIT_PATH, embedding, person_id)

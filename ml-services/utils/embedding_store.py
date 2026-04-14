"""

Embedding store: load/save .npy embedding files, cosine similarity search.

Used by both Re-ID (OSNet) and Gait (GaitSet) search.

"""

import os

import numpy as np



EMBEDDINGS_DIR = os.path.join(os.path.dirname(__file__), "..", "embeddings")

os.makedirs(EMBEDDINGS_DIR, exist_ok=True)



NUM_ATTR = 26



# ── File paths ───────────────────────────────────────────────────────────────

_REID_EMB = os.path.join(EMBEDDINGS_DIR, "gallery_embeddings.npy")

_REID_PATH = os.path.join(EMBEDDINGS_DIR, "gallery_paths.npy")

_REID_ATTR = os.path.join(EMBEDDINGS_DIR, "gallery_attr_probs.npy")

_GAIT_EMB = os.path.join(EMBEDDINGS_DIR, "gait_embeddings.npy")

_GAIT_PATH = os.path.join(EMBEDDINGS_DIR, "gait_paths.npy")





# ── Helpers ──────────────────────────────────────────────────────────────────



def _load(emb_file: str, path_file: str):

    if os.path.exists(emb_file) and os.path.exists(path_file):

        return (

            np.load(emb_file, allow_pickle=False),

            np.load(path_file, allow_pickle=True),

        )

    return np.empty((0,), dtype=np.float32), np.empty((0,), dtype=object)





def _load_attr_matrix(n_rows: int) -> np.ndarray:

    """Shape (n_rows, 26): load file if present and row count matches; else zeros."""

    if n_rows == 0:

        return np.zeros((0, NUM_ATTR), dtype=np.float32)

    if os.path.exists(_REID_ATTR):

        arr = np.load(_REID_ATTR)

        if arr.shape == (n_rows, NUM_ATTR):

            return arr.astype(np.float32, copy=False)

    return np.zeros((n_rows, NUM_ATTR), dtype=np.float32)





def _save_reid_attr(attr: np.ndarray) -> None:

    np.save(_REID_ATTR, attr.astype(np.float32))





def _cosine_top_k(query: np.ndarray, gallery: np.ndarray, k: int = 5):

    """Return top-k (idx, score) tuples sorted by cosine similarity."""

    if gallery.shape[0] == 0:

        return []

    scores = gallery @ query

    top_k = min(k, len(scores))

    idx = np.argsort(scores)[::-1][:top_k]

    return [(int(i), float(scores[i])) for i in idx]





def _l2_normalize_rows(mat: np.ndarray) -> np.ndarray:

    norms = np.linalg.norm(mat, axis=1, keepdims=True)

    norms = np.maximum(norms, 1e-12)

    return mat / norms





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

    return int(paths.shape[0]) - 1





def _coerce_attr_probs(attr_probs: np.ndarray | list | None, n_rows: int) -> np.ndarray:

    if attr_probs is None:

        return np.zeros((n_rows, NUM_ATTR), dtype=np.float32)

    arr = np.asarray(attr_probs, dtype=np.float32)

    if arr.ndim == 1:

        if n_rows != 1:

            raise ValueError("1D attr_probs only valid when n_rows == 1")

        arr = arr.reshape(1, -1)

    if arr.shape != (n_rows, NUM_ATTR):

        raise ValueError(f"attr_probs must have shape ({n_rows}, {NUM_ATTR}), got {arr.shape}")

    return arr





# ── Public Re-ID API ─────────────────────────────────────────────────────────



def reid_search(query_embedding: list, top_k: int = 5) -> list[dict]:

    """Return top-k Re-ID gallery matches with similarity scores."""

    gallery_embs, gallery_paths = _load(_REID_EMB, _REID_PATH)

    query = np.array(query_embedding, dtype=np.float32)



    results = []

    for idx, score in _cosine_top_k(query, gallery_embs, k=top_k):

        path_val = gallery_paths[idx]

        parts = str(path_val).split("|", 1)

        results.append({

            "person_id": parts[0] if len(parts) > 1 else "unknown",

            "image_path": parts[1] if len(parts) > 1 else str(path_val),

            "similarity": round(score, 4),

            "embedding_index": idx,

        })

    return results





def reid_append(

    embedding: list,

    person_id: str,

    image_path: str,

    attr_probs: list | None = None,

) -> int:

    label = f"{person_id}|{image_path}"

    n_before = int(_load(_REID_EMB, _REID_PATH)[1].shape[0])

    attr_before = _load_attr_matrix(n_before)



    idx = _append(_REID_EMB, _REID_PATH, embedding, label)



    if attr_probs is None:

        new_row = np.zeros((1, NUM_ATTR), dtype=np.float32)

    else:

        row = np.asarray(attr_probs, dtype=np.float32).reshape(NUM_ATTR)

        if row.shape[0] != NUM_ATTR:

            raise ValueError(f"attr_probs must have length {NUM_ATTR}")

        new_row = row.reshape(1, -1)



    if n_before == 0:

        attr_new = new_row

    else:

        attr_new = np.vstack([attr_before, new_row])

    _save_reid_attr(attr_new)

    return idx





def reid_rebuild_gallery(

    embeddings: list[list[float]] | np.ndarray,

    labels: list[str],

    attr_probs: np.ndarray | list | None = None,

) -> int:

    """

    Replace the entire Re-ID gallery (embeddings, paths, optional aligned attr probs).

    Each label must be 'person_id|image_path' (same format as reid_append).

    """

    embs = np.asarray(embeddings, dtype=np.float32)

    if embs.size == 0:

        if len(labels) != 0:

            raise ValueError("embeddings and labels must have the same length")

        np.save(_REID_EMB, np.empty((0, 512), dtype=np.float32))

        np.save(_REID_PATH, np.empty((0,), dtype=object))

        np.save(_REID_ATTR, np.empty((0, NUM_ATTR), dtype=np.float32))

        return 0

    if embs.ndim == 1:

        embs = embs.reshape(1, -1)

    paths = np.array(labels, dtype=object)

    n = int(embs.shape[0])

    if n != len(labels):

        raise ValueError("embeddings and labels must have the same length")

    attr = _coerce_attr_probs(attr_probs, n)

    np.save(_REID_EMB, embs)

    np.save(_REID_PATH, paths)

    _save_reid_attr(attr)

    return n





def reid_save_gallery(

    embeddings: list[list[float]] | np.ndarray,

    labels: list[str],

    attr_probs: np.ndarray | list | None = None,

) -> int:

    """Alias for reid_rebuild_gallery (batch save with aligned attribute probabilities)."""

    return reid_rebuild_gallery(embeddings, labels, attr_probs)





def get_gallery_attr_row(idx: int) -> list[float]:

    """Return the 26-dim PA-100K probability row for a gallery index, or zeros if missing."""

    _em, paths = _load(_REID_EMB, _REID_PATH)

    n = int(paths.shape[0])

    if idx < 0 or idx >= n:

        raise IndexError(f"gallery index {idx} out of range (0..{n - 1})")

    mat = _load_attr_matrix(n)

    return [float(x) for x in mat[idx].tolist()]





def multimodal_search(

    query_embedding: list,

    query_attr_probs: list,

    top_k: int = 5,

    w_reid: float = 0.55,

    w_attr: float = 0.45,

) -> tuple[list[dict], int]:

    """

    Fuse OSNet cosine similarity with PA-100K attribute cosine (L2-normalized rows).

    Ranks by fusion_score = w_reid * reid_cosine + w_attr * attr_cosine.

    Returns (results, gallery_total).

    """

    gallery_embs, gallery_paths = _load(_REID_EMB, _REID_PATH)

    n = int(gallery_paths.shape[0])

    if n == 0:

        return [], 0



    q = np.asarray(query_embedding, dtype=np.float32).reshape(-1)

    qa = np.asarray(query_attr_probs, dtype=np.float32).reshape(NUM_ATTR)

    if qa.shape[0] != NUM_ATTR:

        raise ValueError(f"query_attr_probs must have length {NUM_ATTR}")



    attr_mat = _load_attr_matrix(n)

    q_attr_norm = qa / max(np.linalg.norm(qa), 1e-12)

    gallery_attr_norm = _l2_normalize_rows(attr_mat)



    reid_scores = gallery_embs @ q

    attr_dots = gallery_attr_norm @ q_attr_norm

    fusion_scores = w_reid * reid_scores + w_attr * attr_dots



    k = min(top_k, n)

    order = np.argsort(fusion_scores)[::-1][:k]



    results: list[dict] = []

    for idx in order:

        idx = int(idx)

        path_val = gallery_paths[idx]

        parts = str(path_val).split("|", 1)

        reid_score = float(reid_scores[idx])

        attr_score = float(attr_dots[idx])

        fusion = float(fusion_scores[idx])

        raw_probs = [float(x) for x in attr_mat[idx].tolist()]

        results.append({

            "person_id": parts[0] if len(parts) > 1 else "unknown",

            "image_path": parts[1] if len(parts) > 1 else str(path_val),

            "reid_score": round(reid_score, 4),

            "attribute_score": round(attr_score, 4),

            "fusion_score": round(fusion, 4),

            "similarity": round(fusion, 4),

            "embedding_index": idx,

            "raw_probabilities": raw_probs,

        })

    return results, n





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

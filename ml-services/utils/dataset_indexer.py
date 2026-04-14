"""
Build Re-ID gallery .npy files by walking ml-services/datasets/ with OSNet.
Labels match embedding_store.reid_search: "person_id|image_path".
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Ensure ml-services root is importable when this module is loaded from scripts/
_MS_ROOT = Path(__file__).resolve().parent.parent
if str(_MS_ROOT) not in sys.path:
    sys.path.insert(0, str(_MS_ROOT))

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def collect_dataset_images(datasets_root: Path) -> list[Path]:
    if not datasets_root.is_dir():
        return []
    paths: list[Path] = []
    for dirpath, _dirnames, filenames in os.walk(datasets_root):
        for name in filenames:
            if Path(name).suffix.lower() in IMAGE_EXTS:
                paths.append(Path(dirpath) / name)
    paths.sort(key=lambda p: str(p).lower())
    return paths


def _label_for(datasets_root: Path, image_path: Path) -> str:
    """Same format as gallery search: person_id|datasets/<relative path>."""
    rel = image_path.relative_to(datasets_root)
    parts = rel.parts
    if len(parts) == 1:
        person_id = Path(parts[0]).stem
    else:
        person_id = parts[-2]
    posix_rel = rel.as_posix()
    return f"{person_id}|datasets/{posix_rel}"


def index_datasets(
    datasets_root: str | Path,
    *,
    reset: bool = True,
    append: bool = False,
) -> dict:
    """
    Walk datasets_root for images, extract OSNet embeddings, write gallery .npy files.

    - reset=True, append=False: replace gallery with only these images.
    - append=True: merge into existing gallery; skip rows whose label already exists.

    Returns a summary dict with counts and optional errors.
    """
    from models.osnet_model import extract_embedding, load_osnet
    from utils.embedding_store import (
        NUM_ATTR,
        _load,
        _load_attr_matrix,
        _REID_EMB,
        _REID_PATH,
        reid_rebuild_gallery,
    )

    root = Path(datasets_root).resolve()
    load_osnet()

    images = collect_dataset_images(root)
    if not images:
        if reset and not append:
            reid_rebuild_gallery([], [])
        return {
            "datasets_root": str(root),
            "images_found": 0,
            "indexed": 0,
            "errors": [],
            "mode": "replace_empty" if reset and not append else "noop",
        }

    rows: list[list[float]] = []
    labels: list[str] = []
    errors: list[str] = []
    skipped_duplicates = 0

    existing_labels: set[str] = set()
    if append:
        _em, paths = _load(_REID_EMB, _REID_PATH)
        if paths.size > 0:
            existing_labels = {str(paths[i]) for i in range(len(paths))}

    for img_path in images:
        try:
            label = _label_for(root, img_path)
        except ValueError:
            errors.append(f"skip (outside root): {img_path}")
            continue

        if append and label in existing_labels:
            skipped_duplicates += 1
            continue

        try:
            pil = Image.open(img_path).convert("RGB")
            emb = extract_embedding(pil)
        except Exception as e:
            errors.append(f"{img_path}: {e}")
            continue

        rows.append(emb)
        labels.append(label)
        if append:
            existing_labels.add(label)

    if not rows:
        if reset and not append:
            reid_rebuild_gallery([], [])
        elif append and existing_labels:
            pass
        return {
            "datasets_root": str(root),
            "images_found": len(images),
            "indexed": 0,
            "skipped_duplicates": skipped_duplicates if append else 0,
            "skipped_failed": len(errors),
            "errors": errors,
            "mode": "replace_empty" if reset and not append else "append_no_new",
        }

    new_embs = np.array(rows, dtype=np.float32)
    new_labels = labels

    if append and not reset:
        old_em, old_paths = _load(_REID_EMB, _REID_PATH)
        if old_em.ndim == 2 and old_em.shape[0] > 0:
            merged_em = np.vstack([old_em, new_embs])
            merged_labs = [str(old_paths[i]) for i in range(len(old_paths))] + new_labels
            old_n = int(old_paths.shape[0])
            old_attr = _load_attr_matrix(old_n)
            new_attr = np.zeros((len(new_labels), NUM_ATTR), dtype=np.float32)
            merged_attr = np.vstack([old_attr, new_attr])
            reid_rebuild_gallery(merged_em, merged_labs, merged_attr)
        else:
            reid_rebuild_gallery(new_embs, new_labels)
        mode = "append"
    else:
        reid_rebuild_gallery(new_embs, new_labels)
        mode = "replace"

    return {
        "datasets_root": str(root),
        "images_found": len(images),
        "indexed": len(labels),
        "skipped_duplicates": skipped_duplicates if append else 0,
        "skipped_failed": len(errors),
        "errors": errors,
        "mode": mode,
        "embedding_dim": int(new_embs.shape[1]),
    }

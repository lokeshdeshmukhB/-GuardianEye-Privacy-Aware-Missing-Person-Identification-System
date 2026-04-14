#!/usr/bin/env python3
"""
Build Re-ID gallery from a folder tree: OSNet embeddings + PA-100K attribute probabilities.

Default image root: discovers PA-100K .../PA-100K/data under ml-services/datasets/ (see discover_pa100k_data_dir).

Weights (expected under ml-services/weights/):
  - osnet_x1_0_imagenet.pth (or osnet_x1_0.pth)
  - pa100k_last.pth or pa100k_best.pth

Examples (run from ml-services):
  python scripts/build_gallery_from_datasets.py --max-images 200
  python scripts/build_gallery_from_datasets.py --datasets-dir "datasets/datasets/archive (2) (1)/PA-100K/data" --max-images 500
  python scripts/build_gallery_from_datasets.py
    (indexes all images under the chosen root; 100k images can take many hours on CPU)
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

_MS_ROOT = Path(__file__).resolve().parent.parent
if str(_MS_ROOT) not in sys.path:
    sys.path.insert(0, str(_MS_ROOT))

import numpy as np
from PIL import Image

from models.osnet_model import extract_embedding, load_osnet
from models.pa100k_model import load_pa100k, predict_attributes
from utils.embedding_store import reid_save_gallery

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def discover_pa100k_data_dir(ms_root: Path) -> Path | None:
    """Resolve PA-100K image folder (contains many .jpg files)."""
    candidates = [
        ms_root / "datasets" / "datasets" / "archive (2) (1)" / "PA-100K" / "data",
        ms_root / "datasets" / "archive2" / "PA-100K" / "data",
        ms_root / "datasets" / "PA-100K" / "data",
    ]
    for c in candidates:
        if c.is_dir():
            try:
                next(c.iterdir())
            except StopIteration:
                continue
            return c
    for p in ms_root.glob("datasets/**/PA-100K/data"):
        if p.is_dir():
            try:
                next(p.iterdir())
            except StopIteration:
                continue
            return p
    return None


def walk_images(root: Path) -> list[Path]:
    paths: list[Path] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            if Path(name).suffix.lower() in IMAGE_EXTS:
                paths.append(Path(dirpath) / name)
    paths.sort(key=lambda p: str(p).lower())
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Index OSNet + PA-100K rows into gallery_embeddings.npy (and gallery_attr_probs.npy).",
    )
    parser.add_argument(
        "--datasets-dir",
        type=str,
        default=None,
        help="Root directory to walk for images. If omitted, tries to find PA-100K .../PA-100K/data, else ml-services/datasets.",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        help="Cap how many images to index (for testing). Default: no cap (full folder).",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=500,
        help="Print progress every N images (default 500).",
    )
    args = parser.parse_args()

    if args.datasets_dir:
        root = Path(args.datasets_dir).resolve()
    else:
        found = discover_pa100k_data_dir(_MS_ROOT)
        root = found if found else (_MS_ROOT / "datasets")
        print(f"[info] Using datasets root: {root}")
        if found is None:
            print("[warn] PA-100K/data not auto-detected; use --datasets-dir if needed.")

    if not root.is_dir():
        print(f"Not a directory: {root}")
        return 1

    t0 = time.perf_counter()
    print("[info] Loading OSNet + PA-100K…")
    load_osnet()
    load_pa100k()

    images = walk_images(root)
    if args.max_images is not None and args.max_images > 0:
        images = images[: args.max_images]

    if not images:
        print(f"No images found under {root}")
        return 1

    print(f"[info] Indexing {len(images)} image(s) from {root}")

    embeddings: list[list[float]] = []
    labels: list[str] = []
    attr_rows: list[list[float]] = []
    errors: list[str] = []

    for i, img_path in enumerate(images, start=1):
        try:
            rel = img_path.relative_to(root)
            stem = img_path.stem
            relpath = rel.as_posix()
            label = f"{stem}|datasets/{relpath}"
            pil = Image.open(img_path).convert("RGB")
            emb = extract_embedding(pil)
            pa = predict_attributes(pil)
            raw = pa["raw_probabilities"]
            embeddings.append(emb)
            labels.append(label)
            attr_rows.append(raw)
        except Exception as e:
            errors.append(f"{img_path}: {e}")

        if args.progress_every and i % args.progress_every == 0:
            elapsed = time.perf_counter() - t0
            print(f"  {i}/{len(images)} images ({elapsed:.1f}s)")

    if not embeddings:
        print(f"No images indexed. scanned={len(images)} errors={len(errors)}")
        for e in errors[:20]:
            print(e)
        return 1

    embs = np.asarray(embeddings, dtype=np.float32)
    attrs = np.asarray(attr_rows, dtype=np.float32)
    n = reid_save_gallery(embs, labels, attrs)
    elapsed = time.perf_counter() - t0
    print(f"Saved gallery: {n} rows, embedding_dim={embs.shape[1]}, attr_shape={attrs.shape}")
    print(f"Done in {elapsed:.1f}s — images found: {len(images)}, indexed: {n}, errors: {len(errors)}")
    for e in errors[:30]:
        print(f"  ERR: {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

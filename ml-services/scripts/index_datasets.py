#!/usr/bin/env python3
"""
Index images under ml-services/datasets/ into gallery_embeddings.npy / gallery_paths.npy.

Run from the ml-services directory:
  python scripts/index_datasets.py
  python scripts/index_datasets.py --datasets "C:\\path\\to\\folder"
  python scripts/index_datasets.py --dry-run
  python scripts/index_datasets.py --append

Requires OSNet (see models/osnet_model.py) and requirements.txt.
"""
from __future__ import annotations

import argparse
import os
import sys

_MS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _MS_ROOT not in sys.path:
    sys.path.insert(0, _MS_ROOT)


def main() -> None:
    default_datasets = os.path.join(_MS_ROOT, "datasets")
    parser = argparse.ArgumentParser(
        description="Build Re-ID gallery from a folder of images (recursive OSNet indexing).",
    )
    parser.add_argument(
        "--datasets",
        type=str,
        default=default_datasets,
        help=f"Root folder to scan (default: {default_datasets})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only count images; do not load OSNet or write .npy files.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Add new images to the existing gallery instead of replacing it (skips duplicate labels).",
    )
    args = parser.parse_args()

    if args.dry_run:
        from pathlib import Path

        from utils.dataset_indexer import collect_dataset_images

        root = Path(args.datasets).resolve()
        imgs = collect_dataset_images(root)
        print(f"[dry-run] Found {len(imgs)} image(s) under {root}")
        if not imgs:
            print("[warn] No images found; gallery not modified.")
        return

    reset = not args.append
    from utils.dataset_indexer import index_datasets

    out = index_datasets(args.datasets, reset=reset, append=args.append)

    print("─" * 60)
    print("  Dataset indexing complete")
    print("─" * 60)
    for k, v in out.items():
        if k == "errors" and v:
            print(f"  {k}:")
            for e in v[:30]:
                print(f"    - {e}")
            if len(v) > 30:
                print(f"    ... and {len(v) - 30} more")
        else:
            print(f"  {k}: {v}")
    print("─" * 60)


if __name__ == "__main__":
    main()

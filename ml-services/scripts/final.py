#!/usr/bin/env python3
"""
MOT17 precomputed track Re-ID — inference + visualization only (no training).

Paths:
  - Embeddings: ml-services/embeddings/*.npy
  - Crops: MOT17_CROP_ROOT, ml-services/datasets/datasets/MOT17_person_crops, …
  - Silhouettes (optional): MOT17_SILHOUETTE_ROOT, ml-services/datasets/datasets/MOT17_silhouettes, …

Override: MOT17_EMBEDDINGS_DIR, MOT17_CROP_ROOT (optional: ml-services/.env)
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import matplotlib.pyplot as plt

# Allow imports when run as: python scripts/final.py from ml-services/
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import cv2

from utils.mot17_precomputed_reid import (
    compute_similarity,
    explain_attributes,
    explain_match,
    load_embedding_dicts,
    top_attributes,
)


def play_track(track_id: str, delay: float = 0.12, max_frames: int = 25) -> None:
    from utils.mot17_precomputed_reid import mot17_crop_root_candidates, resolve_mot17_crops_dir

    root = resolve_mot17_crops_dir()
    if root is None:
        print(
            "[play_track] No MOT17_person_crops folder found. Set env MOT17_CROP_ROOT or create crops under one of:",
            [str(p) for p in mot17_crop_root_candidates()],
        )
        return

    track_dir = str(root / track_id)
    if not os.path.isdir(track_dir):
        print(f"[play_track] No crop folder: {track_dir}")
        return

    imgs = sorted(os.listdir(track_dir))[:max_frames]

    for img_name in imgs:
        img_path = os.path.join(track_dir, img_name)
        img = cv2.imread(img_path)
        if img is None:
            continue
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, _ = img.shape
        cv2.rectangle(img, (0, 0), (w - 1, h - 1), (255, 0, 0), 2)

        try:
            from IPython.display import clear_output

            clear_output(wait=True)
        except Exception:
            pass
        plt.imshow(img)
        plt.title(track_id)
        plt.axis("off")
        plt.show()
        time.sleep(delay)


def run_query_video(query_id: str, interactive: bool = True) -> None:
    _, attr_embs, _, _ = load_embedding_dicts()

    if query_id not in attr_embs:
        raise SystemExit(f"Unknown track (not in fused embedding index): {query_id}")

    print("🔴 QUERY")
    print("Top Attributes:", top_attributes(attr_embs[query_id]))
    play_track(query_id)

    if interactive:
        input("Press Enter...")

    results = compute_similarity(query_id)

    for i, (tid, final, s_app, s_attr, s_gait) in enumerate(results):
        print("\n" + "=" * 50)
        print(f"Match {i + 1}: {tid}")
        print(f"Final: {final:.3f}")
        print(f"App: {s_app:.3f} | Attr: {s_attr:.3f} | Gait: {s_gait:.3f}")
        print("Reason:", explain_match(s_app, s_attr, s_gait))
        print("Matched Attr:", explain_attributes(query_id, tid))

        if interactive:
            input("Play match...")
        play_track(tid)


def main() -> None:
    p = argparse.ArgumentParser(description="MOT17 precomputed track Re-ID (visual)")
    p.add_argument("--track", default="track_2", help="Query track id, e.g. track_2")
    p.add_argument("--no-input", action="store_true", help="Skip input() pauses between steps")
    args = p.parse_args()
    run_query_video(args.track, interactive=not args.no_input)


if __name__ == "__main__":
    main()

"""Precomputed MOT17 track Re-ID API (embeddings on disk, no model inference)."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from utils import mot17_precomputed_reid as m17

router = APIRouter()


def _frame_base_url() -> str:
    base = os.environ.get("MOT17_FRAME_BASE_URL", "").rstrip("/")
    if base:
        return base
    return "http://127.0.0.1:8001/mot17-crops"


def _silhouette_frame_base_url() -> str:
    base = os.environ.get("MOT17_SILHOUETTE_FRAME_BASE_URL", "").rstrip("/")
    if base:
        return base
    return "http://127.0.0.1:8001/mot17-silhouettes"


@router.get("/status")
def status() -> dict[str, Any]:
    try:
        _, _, _, tids = m17.load_embedding_dicts()
        paths = m17.store_paths()
        resolved = m17.resolve_mot17_crops_dir()
        sil_resolved = m17.resolve_mot17_silhouettes_dir()
        return {
            "ok": True,
            "track_count": len(tids),
            "crops_dir_exists": resolved is not None,
            "crops_resolved": str(resolved) if resolved else None,
            "silhouettes_dir_exists": sil_resolved is not None,
            "silhouettes_resolved": str(sil_resolved) if sil_resolved else None,
            "paths": paths,
            "frame_base_url": _frame_base_url(),
            "silhouette_frame_base_url": _silhouette_frame_base_url(),
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "frame_base_url": _frame_base_url(),
            "silhouette_frame_base_url": _silhouette_frame_base_url(),
        }


@router.get("/tracks")
def list_tracks() -> dict[str, Any]:
    try:
        ids = m17.common_track_ids()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "tracks": ids,
        "frame_base_url": _frame_base_url(),
        "silhouette_frame_base_url": _silhouette_frame_base_url(),
    }


@router.get("/match")
def match_track(
    query_track: str = Query(..., description="e.g. track_2"),
    top_k: int = Query(5, ge=1, le=50),
) -> dict[str, Any]:
    try:
        _, attr_embs, _, _ = m17.load_embedding_dicts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    q = query_track.strip()
    if q not in attr_embs:
        raise HTTPException(status_code=404, detail=f"Unknown track: {q}")

    try:
        ranked = m17.compute_similarity(q, top_k=int(top_k))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    matches: list[dict[str, Any]] = []
    for tid, final, s_app, s_attr, s_gait in ranked:
        matches.append(
            {
                "track_id": tid,
                "final": round(final, 6),
                "appearance": round(s_app, 6),
                "attribute": round(s_attr, 6),
                "gait": round(s_gait, 6),
                "reason": m17.explain_match(s_app, s_attr, s_gait),
                "matched_attributes": m17.explain_attributes(q, tid),
                "top_attributes": m17.top_attributes(attr_embs[tid], k=5),
                "frames": m17.list_track_frames(tid),
                "silhouette_frames": m17.list_track_silhouette_frames(tid),
            }
        )

    return {
        "query_track": q,
        "query_top_attributes": m17.top_attributes(attr_embs[q], k=5),
        "query_frames": m17.list_track_frames(q),
        "query_silhouette_frames": m17.list_track_silhouette_frames(q),
        "frame_base_url": _frame_base_url(),
        "silhouette_frame_base_url": _silhouette_frame_base_url(),
        "weights": {"appearance": 0.6, "attribute": 0.2, "gait": 0.2},
        "matches": matches,
    }

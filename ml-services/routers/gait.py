"""
Gait router: /gait/match and /gait/add
"""
import io
from typing import List
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from PIL import Image

from models.gaitset_model import extract_gait_embedding
from utils.embedding_store import gait_search, gait_append

router = APIRouter()


def _load_frames(files: List[UploadFile]) -> list:
    """Read uploaded files as PIL Images (accepts grayscale PNG/BMP)."""
    frames = []
    for f in files:
        data = f.file.read()
        img = Image.open(io.BytesIO(data))
        frames.append(img)
    return frames


@router.post("/match")
async def match(frames: List[UploadFile] = File(...), top_k: int = 5):
    """
    Upload ≥1 silhouette images (in order) → get top-K gait identity matches.
    Automatically pads/samples to exactly 30 frames.
    """
    if not frames:
        raise HTTPException(status_code=400, detail="No frames uploaded")
    try:
        pil_frames = _load_frames(frames)
        embedding = extract_gait_embedding(pil_frames)
        matches = gait_search(embedding, top_k=top_k)
        return {
            "matches": matches,
            "frames_received": len(pil_frames),
            "embedding_dim": len(embedding),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add")
async def add(frames: List[UploadFile] = File(...), person_id: str = Form(...)):
    """
    Register a person's gait embedding from their silhouette sequence.
    """
    if not frames:
        raise HTTPException(status_code=400, detail="No frames uploaded")
    try:
        pil_frames = _load_frames(frames)
        embedding = extract_gait_embedding(pil_frames)
        idx = gait_append(embedding, person_id)
        return {
            "status": "added",
            "person_id": person_id,
            "frames_used": len(pil_frames),
            "embedding_index": idx,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

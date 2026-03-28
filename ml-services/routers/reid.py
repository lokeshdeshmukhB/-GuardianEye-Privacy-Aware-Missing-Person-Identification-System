"""
Re-ID router: /reid/search and /reid/add-to-gallery
"""
import io
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from PIL import Image

from models.osnet_model import extract_embedding
from utils.embedding_store import reid_search, reid_append

router = APIRouter()


@router.post("/extract")
async def extract(image: UploadFile = File(...)):
    """
    Extract 512-dim OSNet Re-ID embedding (legacy compatibility).
    """
    try:
        data = await image.read()
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        embedding = extract_embedding(pil_img)
        return {
            "embedding": embedding,
            "dim": len(embedding),
            "model": "osnet_x1_0",
            "normalized": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search(image: UploadFile = File(...), top_k: int = 5):
    """
    Upload a query image → get top-K gallery matches ranked by cosine similarity.
    """
    try:
        data = await image.read()
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        query_emb = extract_embedding(pil_img)
        matches = reid_search(query_emb, top_k=top_k)
        return {
            "matches": matches,
            "query_dim": len(query_emb),
            "gallery_size": len(matches),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-to-gallery")
async def add_to_gallery(
    image: UploadFile = File(...),
    person_id: str = Form(...),
    image_path: str = Form(default=""),
):
    """
    Add a person image to the Re-ID gallery (.npy store).
    """
    try:
        data = await image.read()
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        embedding = extract_embedding(pil_img)
        stored_path = image_path or f"upload/{person_id}/{image.filename}"
        idx = reid_append(embedding, person_id, stored_path)
        return {
            "status": "added",
            "person_id": person_id,
            "image_path": stored_path,
            "embedding_index": idx,
            "embedding_dim": len(embedding),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

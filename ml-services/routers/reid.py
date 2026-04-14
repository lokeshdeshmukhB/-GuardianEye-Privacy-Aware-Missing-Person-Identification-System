"""

Re-ID router: /reid/search, /reid/multimodal-search, /reid/add-to-gallery

"""

import io

from fastapi import APIRouter, File, UploadFile, Form, HTTPException

from PIL import Image



from models.osnet_model import extract_embedding

from models.pa100k_model import predict_attributes, structured_attributes_from_probs

from utils.embedding_store import reid_search, reid_append, multimodal_search



router = APIRouter()



GAIT_NOTE = "Gait requires video — not computed for image-only queries."





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

async def search(image: UploadFile = File(...), top_k: int = Form(5)):

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





@router.post("/multimodal-search")

async def multimodal_search_endpoint(

    image: UploadFile = File(...),

    top_k: int = Form(5),

    w_reid: float = Form(0.55),

    w_attr: float = Form(0.45),

):

    """

    OSNet + PA-100K fusion search (no gait for single image).

    """

    try:

        data = await image.read()

        pil_img = Image.open(io.BytesIO(data)).convert("RGB")

        query_emb = extract_embedding(pil_img)

        pa = predict_attributes(pil_img)

        raw = pa["raw_probabilities"]

        matches_raw, gallery_total = multimodal_search(

            query_emb,

            raw,

            top_k=top_k,

            w_reid=w_reid,

            w_attr=w_attr,

        )

        matches = []

        for m in matches_raw:

            probs = m["raw_probabilities"]

            structured = structured_attributes_from_probs(probs)

            row = {**m, "structured_attributes": structured}

            matches.append(row)



        return {

            "matches": matches,

            "query_structured_attributes": pa["structured_attributes"],

            "query_raw_probabilities": raw,

            "fusion_weights": {"w_reid": w_reid, "w_attr": w_attr},

            "gait_note": GAIT_NOTE,

            "gallery_total": gallery_total,

            "query_dim": len(query_emb),

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

        pa = predict_attributes(pil_img)

        attr_probs = pa["raw_probabilities"]

        stored_path = image_path or f"upload/{person_id}/{image.filename}"

        idx = reid_append(embedding, person_id, stored_path, attr_probs=attr_probs)

        return {

            "status": "added",

            "person_id": person_id,

            "image_path": stored_path,

            "embedding_index": idx,

            "embedding_dim": len(embedding),

        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


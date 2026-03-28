"""
Attributes router: /attributes/predict
"""
import io
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

from models.pa100k_model import predict_attributes

router = APIRouter()


@router.post("/predict")
async def predict(image: UploadFile = File(...)):
    """
    Upload a person image → get all 26 PA-100K attribute predictions with confidence scores.
    """
    try:
        data = await image.read()
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        result = predict_attributes(pil_img)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

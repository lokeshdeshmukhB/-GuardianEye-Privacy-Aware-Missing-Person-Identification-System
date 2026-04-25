"""
Person Re-ID FastAPI ML Service
Loads all three models at startup and serves them via dedicated routers.
"""
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import reid, attributes, gait, multimodal, mot17_track_reid
from utils.mot17_precomputed_reid import (
    mot17_crop_root_candidates,
    mot17_silhouette_root_candidates,
    resolve_mot17_crops_dir,
    resolve_mot17_silhouettes_dir,
)
from models.osnet_model import load_osnet
from models.pa100k_model import load_pa100k
from models.gaitset_model import load_gaitset


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all ML models at startup, clean up on shutdown."""
    print("=" * 60)
    print("  Person Re-ID FastAPI Service — Loading Models")
    print("=" * 60)
    load_pa100k()
    load_osnet()
    load_gaitset()
    print("=" * 60)
    print("  All models loaded. Service ready on port 8001.")
    print("=" * 60)
    yield
    # Cleanup (if needed) goes here


app = FastAPI(
    title="Person Re-ID ML Service",
    description="OSNet Re-ID | PA-100K Attributes | GaitSet Recognition",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reid.router, prefix="/reid", tags=["Person Re-ID"])
app.include_router(attributes.router, prefix="/attributes", tags=["Pedestrian Attributes"])
app.include_router(gait.router, prefix="/gait", tags=["Gait Recognition"])
app.include_router(multimodal.router, prefix="/multimodal", tags=["Multimodal Search"])
app.include_router(
    mot17_track_reid.router,
    prefix="/mot17-track-reid",
    tags=["MOT17 Precomputed Track Re-ID"],
)

_mot17_crops = resolve_mot17_crops_dir()
if _mot17_crops is not None:
    app.mount("/mot17-crops", StaticFiles(directory=str(_mot17_crops)), name="mot17_crops")
else:
    print(
        "[MOT17] Crop folder not found — static /mot17-crops disabled. "
        "Set MOT17_CROP_ROOT or place MOT17_person_crops in one of:",
        [str(p) for p in mot17_crop_root_candidates()],
    )

_mot17_sil = resolve_mot17_silhouettes_dir()
if _mot17_sil is not None:
    app.mount("/mot17-silhouettes", StaticFiles(directory=str(_mot17_sil)), name="mot17_silhouettes")
else:
    print(
        "[MOT17] Silhouette folder not found — static /mot17-silhouettes disabled. "
        "Set MOT17_SILHOUETTE_ROOT or place MOT17_silhouettes in one of:",
        [str(p) for p in mot17_silhouette_root_candidates()],
    )


@app.get("/", tags=["Health"])
def root():
    from models.osnet_model import osnet_model
    from models.pa100k_model import pa100k_model
    from models.gaitset_model import gait_model
    import torch
    return {
        "service": "Person Re-ID ML Service",
        "status": "running",
        "models": {
            "osnet_reid": osnet_model is not None,
            "pa100k_attributes": pa100k_model is not None,
            "gaitset": gait_model is not None,
        },
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }

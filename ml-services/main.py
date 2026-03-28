"""
Person Re-ID FastAPI ML Service
Loads all three models at startup and serves them via dedicated routers.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import reid, attributes, gait
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

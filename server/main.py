"""
Supply Daddy — FastAPI Backend
Decentralized logistics platform with blockchain anchoring,
deterministic anomaly detection, and GenAI interpretation.
"""
import os

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from services.firebase_service import init_firebase
from services.blockchain_service import init_blockchain
from routes import shipment, checkpoint, anomaly, auth, route

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("🚀 Supply Daddy starting up...")
    init_firebase()
    init_blockchain()
    logger.info("✅ All services initialized")
    yield
    logger.info("👋 Supply Daddy shutting down")


app = FastAPI(
    title="Supply Daddy",
    description="Decentralized logistics platform with blockchain anchoring and AI-powered anomaly detection",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — dev: allow all, prod: restrict to CORS_ORIGINS env var
_cors_origins = os.getenv("CORS_ORIGINS", "")  # comma-separated in prod
if _cors_origins:
    _allowed = [o.strip() for o in _cors_origins.split(",")]
else:
    _allowed = ["*"]  # dev mode: allow everything

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include route modules
app.include_router(auth.router)
app.include_router(shipment.router)
app.include_router(checkpoint.router)
app.include_router(anomaly.router)
app.include_router(route.router)


@app.get("/")
async def root():
    return {
        "name": "Supply Daddy",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}

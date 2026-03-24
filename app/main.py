import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import alerts, darkweb, organizations, profiles

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Dark Web Monitoring Onboarding",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(organizations.router, prefix="/api/v1", tags=["organizations"])
app.include_router(profiles.router, prefix="/api/v1", tags=["profiles"])
app.include_router(alerts.router, prefix="/api/v1", tags=["alerts"])
app.include_router(darkweb.router, prefix="/api/v1", tags=["darkweb"])

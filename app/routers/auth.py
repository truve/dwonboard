import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

# Simple in-memory token store (good enough for a demo)
_valid_tokens: dict[str, datetime] = {}
TOKEN_TTL_HOURS = 24


class LoginRequest(BaseModel):
    password: str


@router.post("/auth/login")
def login(body: LoginRequest, response: Response) -> dict:
    if not settings.AUTH_PASSWORD:
        # No password configured — auth disabled
        return {"ok": True, "token": "none"}

    if body.password != settings.AUTH_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = secrets.token_hex(32)
    _valid_tokens[token] = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)

    # Clean expired tokens
    now = datetime.now(timezone.utc)
    expired = [t for t, exp in _valid_tokens.items() if exp < now]
    for t in expired:
        del _valid_tokens[t]

    return {"ok": True, "token": token}


@router.get("/auth/check")
def check_auth(request: Request) -> dict:
    if not settings.AUTH_PASSWORD:
        return {"authenticated": True}

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token or token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if _valid_tokens[token] < datetime.now(timezone.utc):
        del _valid_tokens[token]
        raise HTTPException(status_code=401, detail="Token expired")

    return {"authenticated": True}


def require_auth(request: Request) -> None:
    """Dependency to require auth on protected routes."""
    if not settings.AUTH_PASSWORD:
        return  # Auth disabled

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token or token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if _valid_tokens[token] < datetime.now(timezone.utc):
        del _valid_tokens[token]
        raise HTTPException(status_code=401, detail="Token expired")

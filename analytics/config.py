"""Shared config: Mongo connection + optional Gemini key, read from the environment.

Honours shop/.env.local too (same KEY=value format), so one file configures
both the Next.js store and the analytics job. Never commit secrets.
"""

import os
from pathlib import Path
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:  # venv without python-dotenv yet; env vars still work

    def load_dotenv(*args, **kwargs):  # type: ignore[no-redef]
        return False


def _load_files() -> None:
    here = Path(__file__).resolve().parent
    # shop/.env.local first, then repo-local overrides (analytics/.env)
    for name in (".env.local", ".env"):
        p = here.parent / name if name == ".env.local" else here / name
        if p.exists():
            load_dotenv(p)


_load_files()

MONGODB_URI: str = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/shop")
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")


def db_name(uri: str = MONGODB_URI) -> str:
    """Database name from the Mongo URI path, defaulting to 'shop'."""
    path = urlparse(uri).path.strip("/")
    return path or "shop"

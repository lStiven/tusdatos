from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.core.config import get_settings
from app.core.database import engine
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router
from app.modules.venues.router import router as venues_router
from app.shared.exceptions import EXCEPTION_HANDLERS

settings = get_settings()

DESCRIPTION = """
Event management API.

## Errors

Every error response uses the `ErrorResponse` schema:

- `code`: stable, machine-readable identifier. Clients must branch on it.
- `message`: human-readable text. It may change; do not parse it.
- `details`: per-field validation errors; `null` except on `422`.

On `503`, retry after the number of seconds given in the `Retry-After` header.

## Authentication

1. `POST /api/v1/auth/token` with form fields `username` (the email) and `password`.
2. Send the returned token as `Authorization: Bearer <token>`.
3. On `401` with code `token_expired`, log in again.
"""

OPENAPI_TAGS = [
    {"name": "auth", "description": "Registration and login."},
    {"name": "users", "description": "User accounts and profiles."},
    {"name": "venues", "description": "Venues and their rooms. Managed by admins."},
    {"name": "health", "description": "Status of the API and its dependencies."},
]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    yield
    engine.dispose()


def generate_operation_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
    exception_handlers=EXCEPTION_HANDLERS,
    generate_unique_id_function=generate_operation_id,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(venues_router)

app.include_router(health_router)
app.include_router(api_router)

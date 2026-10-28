from fastapi import APIRouter, Response, status

from app.modules.health import service as health_service
from app.modules.health.schemas import HealthResponse
from app.shared.dependencies import SessionDep

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Service health check",
    description=(
        "Checks every component the API depends on (currently: the database). "
        "Returns 200 when all of them work and 503 when any fails; in both cases "
        "`checks` shows the status of each one. Failure details are written only "
        "to the server logs."
    ),
    responses={
        503: {
            "model": HealthResponse,
            "description": "At least one component fails.",
        }
    },
)
def check(session: SessionDep, response: Response) -> HealthResponse:
    checks = health_service.check_health(session)
    healthy = all(checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(status="ok" if healthy else "error", checks=checks)

from fastapi import APIRouter, Response, status

from app.modules.health import service as health_service
from app.modules.health.schemas import HealthResponse
from app.shared.dependencies import SessionDep

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Service health check",
    responses={
        503: {
            "model": HealthResponse,
            "description": "At least one component fails.",
        }
    },
)
def check(session: SessionDep, response: Response) -> HealthResponse:
    """Check every component the API depends on (currently: the database).

    **Rules**
    - `200` when all of them work, `503` when any fails; both return `checks`
      with the status of each one.
    - Failure details go only to the server logs, never to the response.
    - Public and outside `/api/v1`: meant for load balancers and monitoring.
    """
    checks = health_service.check_health(session)
    healthy = all(checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(status="ok" if healthy else "error", checks=checks)

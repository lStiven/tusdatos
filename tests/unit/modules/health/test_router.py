import pytest
from fastapi.testclient import TestClient

from app.modules.health import service as health_service


@pytest.mark.parametrize(
    ("checks", "status_code", "status"),
    [
        ({"database": True}, 200, "ok"),
        ({"database": True, "email": False}, 503, "error"),
    ],
    ids=["all-up", "one-down"],
)
def test_reports_overall_status_from_component_checks(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    checks: dict[str, bool],
    status_code: int,
    status: str,
) -> None:
    monkeypatch.setattr(health_service, "check_health", lambda _: checks)

    response = client.get("/health")

    assert response.status_code == status_code
    assert response.json() == {"status": status, "checks": checks}


def test_is_documented_in_openapi(client: TestClient) -> None:
    operation = client.get("/openapi.json").json()["paths"]["/health"]["get"]

    assert operation["operationId"] == "health-check"
    assert operation["tags"] == ["health"]
    for status_code in ("200", "503"):
        content = operation["responses"][status_code]["content"]
        assert content["application/json"]["schema"] == {
            "$ref": "#/components/schemas/HealthResponse"
        }

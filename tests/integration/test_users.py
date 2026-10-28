from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import create_access_token
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.users.models import RoleCode
from app.shared.datetimes import utc_now
from app.shared.models import id_of


def create_user(session: Session, email: str, *roles: RoleCode) -> tuple[int, str]:
    user = auth_service.register(
        session,
        RegisterRequest(email=email, password="pw-123456", full_name="U"),
        roles=(RoleCode.ATTENDEE, *roles),
    )
    return id_of(user), f"Bearer {create_access_token(id_of(user))}"


def test_admins_grant_and_revoke_roles_but_never_the_last_admin(
    client: TestClient, session: Session
) -> None:
    boss, boss_token = create_user(session, "boss@example.com", RoleCode.ADMIN)
    ana, _ = create_user(session, "ana@example.com")
    client.headers["Authorization"] = boss_token

    granted = client.put(f"/api/v1/users/{ana}/roles/ADMIN")
    again = client.put(f"/api/v1/users/{ana}/roles/ADMIN")
    admins = client.get("/api/v1/users?role=ADMIN").json()
    demoted = client.delete(f"/api/v1/users/{ana}/roles/ADMIN")
    last = client.delete(f"/api/v1/users/{boss}/roles/ADMIN")

    assert granted.json()["roles"] == again.json()["roles"] == ["ATTENDEE", "ADMIN"]
    assert [user["email"] for user in admins["items"]] == [
        "ana@example.com",
        "boss@example.com",
    ]
    assert demoted.json()["roles"] == ["ATTENDEE"]
    assert last.json()["code"] == "last_admin"


def test_a_revoked_organizer_can_no_longer_change_their_events(
    client: TestClient, session: Session
) -> None:
    _, boss_token = create_user(session, "boss@example.com", RoleCode.ADMIN)
    org, org_token = create_user(session, "org@example.com", RoleCode.ORGANIZER)
    now = utc_now()
    client.headers["Authorization"] = org_token
    event = client.post(
        "/api/v1/events",
        json={
            "title": "PyCon",
            "capacity": 10,
            "starts_at": (now + timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=2)).isoformat(),
            "timezone": "America/Bogota",
        },
    ).json()

    client.headers["Authorization"] = boss_token
    client.delete(f"/api/v1/users/{org}/roles/ORGANIZER")
    client.headers["Authorization"] = org_token
    edit = client.patch(f"/api/v1/events/{event['id']}", json={"title": "Mine"})
    create = client.post("/api/v1/events", json={})

    assert edit.json()["code"] == "not_event_owner"
    assert create.json()["code"] == "forbidden"

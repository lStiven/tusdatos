from unittest.mock import MagicMock

import pytest
from sqlmodel import Session

from app.modules.demo import cli as demo_cli
from app.modules.demo import service as demo_service
from app.modules.events.models import EventStatus
from app.modules.users.models import RoleCode
from app.shared.exceptions import ConflictError

DATA = demo_service.DemoData(
    accounts=[
        demo_service.SeededAccount(
            "admin@demo.example.com", [RoleCode.ATTENDEE, RoleCode.ADMIN]
        )
    ],
    events=[demo_service.SeededEvent(1, "PyData Bogotá", EventStatus.PUBLISHED)],
)


@pytest.fixture(autouse=True)
def no_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(demo_cli, "engine", MagicMock())
    monkeypatch.setattr(demo_cli, "Session", MagicMock())


@pytest.mark.parametrize(
    ("data", "output"),
    [
        (
            DATA,
            "Demo data created. Every account uses the password demo1234\n"
            "\nAccounts:\n"
            "  admin@demo.example.com       ATTENDEE, ADMIN\n"
            "\nEvents:\n"
            "  #1    PUBLISHED  PyData Bogotá\n"
            "\nWhat to try with each one: backend/README.md, section 'Datos de demo'\n",
        ),
        (
            None,
            "Demo data already present (admin@demo.example.com exists): "
            "nothing to do\n",
        ),
    ],
    ids=["created", "already-present"],
)
def test_prints_what_it_did(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    data: demo_service.DemoData | None,
    output: str,
) -> None:
    monkeypatch.setattr(demo_service, "seed", lambda session: data)

    demo_cli.main(["seed"])

    assert capsys.readouterr().out == output


def test_fails_with_a_readable_message(monkeypatch: pytest.MonkeyPatch) -> None:
    def seed(session: Session) -> None:
        raise ConflictError("Email already exists", code="email_taken")

    monkeypatch.setattr(demo_service, "seed", seed)

    with pytest.raises(SystemExit) as info:
        demo_cli.main(["seed"])

    assert info.value.code == "Demo data not created: Email already exists"

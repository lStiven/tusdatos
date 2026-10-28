from unittest.mock import Mock

import pytest
from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from app.modules.health import service as health_service


def test_reports_database_up() -> None:
    assert health_service.check_health(Mock(spec=Session)) == {"database": True}


def test_reports_database_down_and_logs_the_error(
    caplog: pytest.LogCaptureFixture,
) -> None:
    session = Mock(spec=Session)
    session.exec.side_effect = OperationalError("SELECT 1", {}, Exception("refused"))

    assert health_service.check_health(session) == {"database": False}
    [record] = caplog.records
    assert record.getMessage() == "Health check failed: database"
    assert record.exc_info is not None

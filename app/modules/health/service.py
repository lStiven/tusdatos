import logging
from collections.abc import Callable

from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def check_health(session: Session) -> dict[str, bool]:
    return {
        "database": _run_check("database", lambda: session.exec(select(1))),
    }


def _run_check(name: str, check: Callable[[], object]) -> bool:
    try:
        check()
    except Exception:
        logger.exception("Health check failed: %s", name)
        return False
    return True

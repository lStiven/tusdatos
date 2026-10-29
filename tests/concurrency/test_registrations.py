"""Concurrency scenarios of docs/03 §7, against real PostgreSQL connections."""

import pytest
from sqlalchemy import Engine
from sqlmodel import Session

from app.modules.events import service as events_service
from app.modules.events.schemas import EventUpdate
from app.modules.registrations import repository as registrations_repository
from app.modules.registrations import service as registrations_service
from app.modules.registrations.models import RegistrationStatus
from app.modules.users.models import RoleCode
from tests.concurrency.conftest import (
    Call,
    count_rows,
    make_event,
    make_users,
    registrations,
    run_together,
    user,
    waitlist_orders,
)

CONFIRMED, WAITLISTED = RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED


def register(event_id: int, user_id: int) -> Call[RegistrationStatus]:
    return lambda session: (
        registrations_service.register(session, user(session, user_id), event_id)[
            0
        ].status
    )


def test_c01_the_last_seat_is_never_oversold(engine: Engine) -> None:
    seated = make_users(engine, 29)
    event_id = make_event(engine, capacity=30, confirmed=seated)
    newcomers = make_users(engine, 39)

    statuses = run_together(engine, [register(event_id, uid) for uid in newcomers])

    assert (statuses.count(CONFIRMED), statuses.count(WAITLISTED)) == (1, 38)
    final = registrations(engine, event_id)
    assert len(final[CONFIRMED]) == 30
    assert waitlist_orders(engine, event_id) == list(range(1, 39))


def test_c02_one_user_retrying_twenty_times_has_one_registration(
    engine: Engine,
) -> None:
    event_id = make_event(engine, capacity=5)
    (uid,) = make_users(engine, 1)

    def attempt(session: Session) -> tuple[int, bool]:
        registration, created = registrations_service.register(
            session, user(session, uid), event_id
        )
        return registration.id, created

    results = run_together(engine, [attempt] * 20)

    assert len({result[0] for result in results if isinstance(result, tuple)}) == 1
    assert [result[1] for result in results if isinstance(result, tuple)].count(
        True
    ) == 1
    assert count_rows(engine, event_id) == 1


def test_c03_a_freed_seat_goes_to_the_queue_not_to_newcomers(engine: Engine) -> None:
    leaving, staying, waiting, *newcomers = make_users(engine, 6)
    event_id = make_event(
        engine, capacity=2, confirmed=[leaving, staying], waitlisted=[waiting]
    )

    def cancel(session: Session) -> RegistrationStatus:
        return registrations_service.cancel(
            session, user(session, leaving), event_id
        ).status

    run_together(engine, [cancel, *(register(event_id, uid) for uid in newcomers)])

    final = registrations(engine, event_id)
    assert sorted(final[CONFIRMED]) == sorted([staying, waiting])
    assert sorted(final[WAITLISTED]) == sorted(newcomers)


def test_c04_raising_capacity_promotes_exactly_the_new_seats_in_order(
    engine: Engine,
) -> None:
    (admin,) = make_users(engine, 1, RoleCode.ADMIN)
    seated, queue, newcomers = (
        make_users(engine, 5),
        make_users(engine, 10),
        make_users(engine, 5),
    )
    event_id = make_event(engine, capacity=5, confirmed=seated, waitlisted=queue)

    def raise_capacity(session: Session) -> int:
        return events_service.update_event(
            session, user(session, admin), event_id, EventUpdate(capacity=8)
        ).capacity

    run_together(
        engine, [raise_capacity, *(register(event_id, uid) for uid in newcomers)]
    )

    final = registrations(engine, event_id)
    assert sorted(final[CONFIRMED]) == sorted([*seated, *queue[:3]])
    assert final[WAITLISTED][:7] == queue[3:]
    assert sorted(final[WAITLISTED][7:]) == sorted(newcomers)


def test_c05_capacity_never_drops_below_the_confirmed(engine: Engine) -> None:
    admins = make_users(engine, 2, RoleCode.ADMIN)
    event_id = make_event(engine, capacity=10, confirmed=make_users(engine, 5))
    newcomers = make_users(engine, 5)

    def shrink(admin_id: int) -> Call[int]:
        return lambda session: (
            events_service.update_event(
                session, user(session, admin_id), event_id, EventUpdate(capacity=6)
            ).capacity
        )

    run_together(
        engine,
        [
            *(shrink(admin_id) for admin_id in admins),
            *(register(event_id, uid) for uid in newcomers),
        ],
    )

    with Session(engine) as session:
        capacity = events_service.get_event(
            session, user(session, admins[0]), event_id
        ).capacity
        confirmed = registrations_repository.count_confirmed(session, event_id)
    assert confirmed <= capacity


def test_c06_a_failure_before_commit_leaves_nothing_and_releases_the_lock(
    engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    event_id = make_event(engine, capacity=5)
    failing, other = make_users(engine, 2)

    def crash(*args: object, **kwargs: object) -> None:
        raise RuntimeError("crash before commit")

    monkeypatch.setattr(registrations_repository, "add_history", crash)
    with Session(engine) as session, pytest.raises(RuntimeError):
        registrations_service.register(session, user(session, failing), event_id)
    monkeypatch.undo()

    # Within lock_timeout: a lock left behind would make this fail.
    with Session(engine) as session:
        registration, _ = registrations_service.register(
            session, user(session, other), event_id
        )

    assert registration.status == CONFIRMED
    assert registrations(engine, event_id)[CONFIRMED] == [other]


def test_c07_events_do_not_block_each_other(engine: Engine) -> None:
    first, second = make_event(engine, capacity=5), make_event(engine, capacity=5)
    people = make_users(engine, 20)

    run_together(
        engine,
        [register(event_id, uid) for uid in people for event_id in (first, second)],
    )

    for event_id in (first, second):
        final = registrations(engine, event_id)
        assert (len(final[CONFIRMED]), len(final[WAITLISTED])) == (5, 15)

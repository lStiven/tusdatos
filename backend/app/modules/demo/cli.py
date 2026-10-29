import argparse
from collections.abc import Sequence

from sqlmodel import Session

from app.core.database import engine
from app.modules.demo import service as demo_service
from app.shared.exceptions import AppError


def seed() -> None:
    # One transaction: every service commit becomes a savepoint, so a failure
    # halfway leaves nothing behind.
    with engine.connect() as connection, connection.begin():
        with Session(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            try:
                data = demo_service.seed(session)
            except AppError as exc:
                raise SystemExit(f"Demo data not created: {exc.message}") from exc
    if data is None:
        admin = demo_service.email_of("admin")
        print(f"Demo data already present ({admin} exists): nothing to do")
        return
    print(f"Demo data created. Every account uses the password {demo_service.PASSWORD}")
    print("\nAccounts:")
    for account in data.accounts:
        print(f"  {account.email:<28} {', '.join(account.roles)}")
    print("\nEvents:")
    for event in data.events:
        print(f"  #{event.id:<4} {event.status:<10} {event.title}")
    print("\nWhat to try with each one: backend/README.md, section 'Datos de demo'")


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.modules.demo.cli",
        description="Optional demo data for trying the API by hand.",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser(
        "seed",
        help="create demo accounts, venues, events and sessions",
        description="Create the demo data in one transaction; does nothing if it "
        "already exists.",
    )
    parser.parse_args(argv)
    seed()


if __name__ == "__main__":
    main()

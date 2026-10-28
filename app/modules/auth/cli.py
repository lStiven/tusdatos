import argparse
import getpass
import os
from collections.abc import Sequence

from pydantic import ValidationError
from sqlmodel import Session

from app.core.database import engine
from app.modules.auth import service as auth_service
from app.modules.auth.schemas import RegisterRequest
from app.modules.users.models import RoleCode
from app.shared.exceptions import ConflictError

PASSWORD_ENV = "ADMIN_PASSWORD"


def read_password() -> str:
    """Read the password from ADMIN_PASSWORD or prompt for it twice.

    Never take it as an argument: it would end up in the shell history and in
    the process list.
    """
    if password := os.environ.get(PASSWORD_ENV):
        return password
    password = getpass.getpass("Password: ")
    if getpass.getpass("Repeat password: ") != password:
        raise SystemExit("Passwords do not match")
    return password


def create_admin(email: str, full_name: str) -> None:
    try:
        request = RegisterRequest(
            email=email, password=read_password(), full_name=full_name
        )
    except ValidationError as exc:
        errors = (f"{error['loc'][0]}: {error['msg']}" for error in exc.errors())
        raise SystemExit("; ".join(errors)) from exc
    with Session(engine) as session:
        try:
            user = auth_service.register(
                session, request, roles=(RoleCode.ATTENDEE, RoleCode.ADMIN)
            )
        except ConflictError as exc:
            raise SystemExit(exc.message) from exc
        print(f"Admin created: {user.email} (id {user.id})")


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.modules.auth.cli",
        description="Account administration commands.",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    admin = commands.add_parser(
        "create-admin",
        help="create a user with the ADMIN role",
        description=f"Create a user with the ADMIN role. The password is read "
        f"from {PASSWORD_ENV} or prompted.",
    )
    admin.add_argument("--email", required=True)
    admin.add_argument("--full-name", required=True)
    args = parser.parse_args(argv)
    create_admin(args.email, args.full_name)


if __name__ == "__main__":
    main()

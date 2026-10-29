import re

from alembic import command
from sqlalchemy import Engine, inspect, text
from sqlalchemy import Enum as SAEnum
from sqlmodel import Session, SQLModel, select

from app.modules.users.models import Role, RoleCode
from tests.conftest import alembic_config


def test_downgrade_removes_the_schema_and_upgrade_matches_the_models(
    test_engine: Engine,
) -> None:
    with test_engine.begin() as connection:
        config = alembic_config(connection)

        command.downgrade(config, "base")
        assert inspect(connection).get_table_names() == ["alembic_version"]

        command.upgrade(config, "head")
        command.check(config)


def test_migration_seeds_the_role_catalog(session: Session) -> None:
    assert set(session.exec(select(Role.code)).all()) == set(RoleCode)


def test_enum_checks_allow_exactly_the_python_values(test_engine: Engine) -> None:
    """`alembic check` ignores CHECK constraints: an enum value added without its
    migration would only fail on the first INSERT that uses it."""
    expected = {
        f"ck_{table.name}_{column.type.name}": set(column.type.enums)
        for table in SQLModel.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, SAEnum)
    }
    with test_engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = ANY(:names)"
            ),
            {"names": list(expected)},
        )
        in_database = {
            name: set(re.findall(r"'([^']*)'", definition)) for name, definition in rows
        }

    assert expected
    assert in_database == expected

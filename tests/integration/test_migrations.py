from alembic import command
from sqlalchemy import Engine, inspect
from sqlmodel import Session, select

from app.modules.users.models import Role, RoleCode
from tests.integration.conftest import alembic_config


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

from alembic import context
from sqlalchemy import create_engine, pool

from database import get_database_url
from models import Base


def run_migrations() -> None:
    if context.is_offline_mode():
        context.configure(url=get_database_url(), target_metadata=Base.metadata, literal_binds=True)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_engine(get_database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations()

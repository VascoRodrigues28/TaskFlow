from collections.abc import Iterator
from functools import cache
from os import getenv
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session


class Base(DeclarativeBase):
    pass


def get_database_url() -> str:
    load_dotenv(Path(__file__).with_name(".env"))
    database_url = getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Define DATABASE_URL no ambiente ou em backend/.env.")
    return database_url


@cache
def get_engine() -> Engine:
    return create_engine(get_database_url(), pool_pre_ping=True)


def get_session() -> Iterator[Session]:
    with Session(get_engine(), expire_on_commit=False) as session:
        yield session

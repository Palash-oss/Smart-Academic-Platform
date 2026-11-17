"""Shared fixtures for API tests: real Postgres, seeded world, authenticated clients.

How it works
- Once per pytest run, a uniquely named *template* database is created on the
  docker-compose Postgres, the schema is built in it and the seed world is loaded.
- Each test gets its own database cloned from that template (fast, fully isolated),
  dropped afterwards. Parallel runs never share a database because every name
  carries a per-run random id.
- The app's ``get_db`` dependency is overridden to point at the test database. The
  configured ``DATABASE_URL`` (which may be a remote database) is never used.
"""
import os
import uuid
from datetime import date

import pytest
import pytest_asyncio
import sqlalchemy as sa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import URL
from sqlalchemy.pool import NullPool

from app.api import auth as auth_module  # noqa: E402
from app.core import clock  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from tests.seed import SeedUser, SeedWorld, seed_world  # noqa: E402


def _db_url(database: str, driver: str) -> URL:
    """Connection URL to the docker-compose Postgres (never the configured DATABASE_URL)."""
    return URL.create(
        drivername=f"postgresql+{driver}",
        username=os.getenv("TEST_POSTGRES_USER", settings.POSTGRES_USER),
        password=os.getenv("TEST_POSTGRES_PASSWORD", settings.POSTGRES_PASSWORD),
        host=os.getenv("TEST_POSTGRES_HOST", settings.EFFECTIVE_POSTGRES_HOST),
        port=int(os.getenv("TEST_POSTGRES_PORT", settings.POSTGRES_PORT)),
        database=database,
    )


def _admin_engine() -> sa.Engine:
    # Connect to the maintenance DB; AUTOCOMMIT because CREATE/DROP DATABASE can't run in a transaction.
    return sa.create_engine(_db_url("postgres", "psycopg2"), isolation_level="AUTOCOMMIT", poolclass=NullPool)


@pytest.fixture(scope="session")
def run_id() -> str:
    return uuid.uuid4().hex[:10]


@pytest.fixture(scope="session")
def template_db(run_id):
    """A seeded database that every test database is cloned from."""
    name = f"sap_test_{run_id}_tpl"
    admin = _admin_engine()
    try:
        with admin.connect() as conn:
            conn.execute(sa.text(f'CREATE DATABASE "{name}"'))
    except sa.exc.OperationalError as exc:
        admin.dispose()
        pytest.exit(
            "API tests need the docker-compose Postgres running (`docker compose up -d db`).\n"
            f"Could not connect: {exc.orig}",
            returncode=2,
        )
    engine = sa.create_engine(_db_url(name, "psycopg2"), poolclass=NullPool)
    try:
        with engine.begin() as conn:
            conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(engine)
        with sa.orm.Session(engine) as session:
            world = seed_world(session)
    finally:
        engine.dispose()
    yield name, world
    with admin.connect() as conn:
        conn.execute(sa.text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture(scope="session")
def seed(template_db) -> SeedWorld:
    return template_db[1]


@pytest.fixture
def test_db_name(template_db, run_id):
    """A fresh, uniquely named database cloned from the seeded template, dropped after the test."""
    name = f"sap_test_{run_id}_{uuid.uuid4().hex[:8]}"
    admin = _admin_engine()
    with admin.connect() as conn:
        conn.execute(sa.text(f'CREATE DATABASE "{name}" TEMPLATE "{template_db[0]}"'))
    yield name
    with admin.connect() as conn:
        conn.execute(sa.text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


@pytest_asyncio.fixture
async def db_session(test_db_name):
    """An AsyncSession on the test database, for arranging or inspecting state directly."""
    engine = create_async_engine(_db_url(test_db_name, "asyncpg"), poolclass=NullPool)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    async with maker() as session:
        app.dependency_overrides[get_db] = _db_override(maker)
        auth_module._USER_OBJECT_CACHE.clear()
        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db, None)
            auth_module._USER_OBJECT_CACHE.clear()
    await engine.dispose()


def _db_override(maker):
    async def override():
        async with maker() as session:
            yield session
    return override


@pytest.fixture
def pin_today():
    """Call ``pin_today(date(...))`` to fix what the app considers "today"."""
    clock.set_today(None)
    yield clock.set_today
    clock.set_today(None)


@pytest_asyncio.fixture
async def client(db_session):
    """Unauthenticated httpx client calling the FastAPI app in-process (no server needed)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _auth_headers(user: SeedUser) -> dict[str, str]:
    token = create_access_token(subject=user.id, role=user.role, email=user.email)
    return {"Authorization": f"Bearer {token}"}


def _authed_client(user: SeedUser):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=_auth_headers(user))


@pytest_asyncio.fixture
async def faculty_client(db_session, seed):
    """Client logged in as faculty 1 (teaches Operating Systems to Division A)."""
    async with _authed_client(seed.faculty["f1"]) as c:
        yield c


@pytest_asyncio.fixture
async def other_faculty_client(db_session, seed):
    """Client logged in as faculty 2 (teaches Computer Networks to Division B)."""
    async with _authed_client(seed.faculty["f2"]) as c:
        yield c


@pytest_asyncio.fixture
async def student_a_client(db_session, seed):
    """Client logged in as the first student of Division A."""
    async with _authed_client(seed.students["A"][0]) as c:
        yield c


@pytest_asyncio.fixture
async def student_b_client(db_session, seed):
    """Client logged in as the first student of Division B."""
    async with _authed_client(seed.students["B"][0]) as c:
        yield c


@pytest_asyncio.fixture
async def admin_client(db_session, seed):
    async with _authed_client(seed.admin) as c:
        yield c

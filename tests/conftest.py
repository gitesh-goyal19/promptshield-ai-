import os
import tempfile
import sys

# Use a temp SQLite DB for tests, set BEFORE importing the app modules.
_fd, _path = tempfile.mkstemp(suffix=".db")
os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_path}"
os.environ["GEMINI_API_KEY"] = ""
os.environ["FRONTEND_ORIGIN"] = "http://localhost:5173"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402

from db import SessionLocal, engine, Base, init_db  # noqa: E402
import db.models  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    # Fresh session per test; roll back after.
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

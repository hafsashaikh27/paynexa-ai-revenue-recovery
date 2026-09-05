import json
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.database import Base, get_db
from backend.app.main import app


@pytest.fixture(autouse=True)
def mock_gemini_api_call(monkeypatch):
    """Mocks outbound Gemini API HTTP calls to return realistic structured JSON without network delay."""
    orig_post = httpx.Client.post

    def mock_post(self, url, *args, **kwargs):
        if "generativelanguage.googleapis.com" in str(url):
            sample_gemini_response = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps({
                                        "summary": "High recovery probability based on network timeout and positive customer history.",
                                        "risk_level": "LOW",
                                        "recovery_likelihood": "HIGH",
                                        "key_factors": [
                                            {
                                                "feature": "Failure Reason (Network Timeout)",
                                                "impact": "POSITIVE",
                                                "explanation": "Transient network timeout resolves on scheduled retry."
                                            }
                                        ],
                                        "recommended_next_step": "Recommend automated background retry after 2 hours cooldown.",
                                        "confidence": 0.92,
                                    })
                                }
                            ]
                        }
                    }
                ]
            }
            return httpx.Response(
                status_code=200,
                json=sample_gemini_response,
                request=httpx.Request("POST", url),
            )
        return orig_post(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.Client, "post", mock_post)


@pytest.fixture(scope="session")
def engine():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

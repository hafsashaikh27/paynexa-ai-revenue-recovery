"""Unit tests for Phase 5: LLM Abstraction, Sanitization, Providers, and Reasoning Service."""
import uuid
import pytest
from backend.app.models.entities import (
    Merchant,
    Customer,
    Transaction,
    RecoveryCase,
    ModelPrediction,
    LLMExplanation,
)
from backend.app.llm.prompt_builder import sanitize_context, build_explanation_prompt
from backend.app.llm.providers import MockLLMProvider, GeminiLLMProvider, OpenAILLMProvider
from backend.app.llm.factory import get_llm_provider
from backend.app.services.reasoning_service import ReasoningService


def seed_test_case(db):
    merch = Merchant(name="Reasoning M", code=f"RM_{uuid.uuid4().hex[:6]}", category="SaaS")
    db.add(merch)
    db.commit()

    cust = Customer(merchant_id=merch.id, external_customer_id=f"C_{uuid.uuid4().hex[:6]}", email="cexp@test.com")
    db.add(cust)
    db.commit()

    tx = Transaction(
        merchant_id=merch.id,
        customer_id=cust.id,
        amount_minor=180000,
        payment_method="CREDIT_CARD",
        status="FAILED",
        failure_reason="CARD_DECLINED",
    )
    db.add(tx)
    db.commit()

    case = RecoveryCase(
        transaction_id=tx.id,
        merchant_id=merch.id,
        customer_id=cust.id,
        status="NEW",
        priority="MEDIUM",
        revenue_at_risk_minor=180000,
        recovered_amount_minor=0,
    )
    db.add(case)
    db.commit()
    return case


def test_sanitize_context_whitelist():
    raw = {
        "amount_minor": 50000,
        "payment_method": "UPI",
        "failure_reason": "NETWORK_TIMEOUT",
        "is_subscription": True,
        "unauthorized_secret_field": "do_not_include",
        "password": "supersecretpassword",
        "api_key": "sk-1234567890",
        "bearer_token": "Bearer abcdef123",
        "database_url": "postgres://user:pass@localhost/db",
    }
    sanitized = sanitize_context(raw)

    assert "amount_minor" in sanitized
    assert "payment_method" in sanitized
    assert "failure_reason" in sanitized
    assert "is_subscription" in sanitized
    assert "unauthorized_secret_field" not in sanitized
    assert "password" not in sanitized
    assert "api_key" not in sanitized
    assert "bearer_token" not in sanitized
    assert "database_url" not in sanitized


def test_sanitize_context_redacts_sql_and_bearer_strings():
    raw = {
        "amount_minor": 50000,
        "payment_method": "Bearer xyz12345",
        "failure_reason": "postgres://root:secret@localhost:5432/db",
    }
    sanitized = sanitize_context(raw)
    assert "payment_method" not in sanitized
    assert "failure_reason" not in sanitized


def test_prompt_builder_structure():
    context = {
        "amount_minor": 120000,
        "payment_method": "CREDIT_CARD",
        "failure_reason": "INSUFFICIENT_FUNDS",
        "prediction": 0.45,
        "model_version": "1.0.0",
        "feature_version": "1.0.0",
    }
    prompt = build_explanation_prompt(context)

    assert "RecoverAI's Explanation Engine" in prompt
    assert "DO NOT execute payments" in prompt
    assert "REQUIRED JSON SCHEMA" in prompt
    assert "INSUFFICIENT_FUNDS" in prompt


def test_mock_llm_provider_high_probability():
    provider = MockLLMProvider()
    context = {
        "prediction": 0.85,
        "failure_reason": "NETWORK_TIMEOUT",
        "retry_count": 0,
        "successful_payments_count": 5,
        "failed_payments_count": 0,
    }
    result = provider.generate_structured_explanation("test prompt", context)

    assert result["risk_level"] == "LOW"
    assert result["recovery_likelihood"] == "HIGH"
    assert len(result["key_factors"]) > 0
    assert "recommended_next_step" in result
    assert 0.0 <= result["confidence"] <= 1.0


def test_mock_llm_provider_low_probability():
    provider = MockLLMProvider()
    context = {
        "prediction": 0.25,
        "failure_reason": "EXPIRED_CARD",
        "retry_count": 3,
        "successful_payments_count": 0,
        "failed_payments_count": 4,
    }
    result = provider.generate_structured_explanation("test prompt", context)

    assert result["risk_level"] == "HIGH"
    assert result["recovery_likelihood"] == "LOW"


def test_mock_llm_provider_medium_probability():
    provider = MockLLMProvider()
    context = {
        "prediction": 0.55,
        "failure_reason": "INSUFFICIENT_FUNDS",
        "retry_count": 1,
        "successful_payments_count": 2,
        "failed_payments_count": 2,
    }
    result = provider.generate_structured_explanation("test prompt", context)

    assert result["risk_level"] == "MEDIUM"
    assert result["recovery_likelihood"] == "MEDIUM"


def test_mock_llm_status():
    provider = MockLLMProvider()
    status = provider.get_status()
    assert status["provider"] == "MOCK"
    assert status["status"] == "operational"
    assert status["mode"] == "offline"


def test_gemini_provider_missing_key_error():
    provider = GeminiLLMProvider(api_key="")
    with pytest.raises(ValueError, match="Gemini API key is not configured"):
        provider.generate_structured_explanation("prompt", {})


def test_gemini_provider_status():
    provider_no_key = GeminiLLMProvider(api_key="", model="gemini-3.7-flash")
    status_no_key = provider_no_key.get_status()
    assert status_no_key["provider"] == "GEMINI"
    assert status_no_key["status"] == "missing_api_key"
    assert status_no_key["model_name"] == "gemini-3.7-flash"

    provider_with_key = GeminiLLMProvider(api_key="valid-test-key-12345", model="gemini-3.7-flash")
    status_with_key = provider_with_key.get_status()
    assert status_with_key["provider"] == "GEMINI"
    assert status_with_key["status"] == "configured"
    assert status_with_key["mode"] == "live"


def test_openai_and_anthropic_are_optional():
    """Verify that OpenAI and Anthropic are optional and not required to run."""
    from backend.app.config import settings
    # Neither OpenAI nor Anthropic API key is strictly required
    assert settings.OPENAI_API_KEY is None or isinstance(settings.OPENAI_API_KEY, str)
    assert settings.ANTHROPIC_API_KEY is None or isinstance(settings.ANTHROPIC_API_KEY, str)


def test_llm_factory_gemini_or_mock():
    provider = get_llm_provider()
    assert isinstance(provider, (GeminiLLMProvider, MockLLMProvider))


def test_reasoning_service_append_only_and_immutability(db_session):
    case = seed_test_case(db_session)

    # Generate first explanation
    exp1 = ReasoningService.generate_and_save_explanation(db_session, case.id)
    assert exp1.id is not None
    assert exp1.recovery_case_id == case.id

    # Generate second explanation for the same case
    exp2 = ReasoningService.generate_and_save_explanation(db_session, case.id)
    assert exp2.id is not None
    assert exp1.id != exp2.id  # Append-only: creates distinct records!

    # Check history
    history = ReasoningService.get_explanations_history(db_session, case.id)
    assert len(history) >= 2


def test_api_explain_endpoint(client, db_session):
    case = seed_test_case(db_session)
    response = client.post(f"/api/recovery-cases/{case.id}/explain")
    assert response.status_code == 200
    data = response.json()
    assert data["recovery_case_id"] == case.id
    assert "summary" in data
    assert "risk_level" in data
    assert "recovery_likelihood" in data
    assert "key_factors" in data
    assert "recommended_next_step" in data


def test_api_get_explanations_history(client, db_session):
    case = seed_test_case(db_session)
    ReasoningService.generate_and_save_explanation(db_session, case.id)

    response = client.get(f"/api/recovery-cases/{case.id}/explanations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

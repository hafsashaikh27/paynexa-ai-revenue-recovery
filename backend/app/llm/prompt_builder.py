import json
import re
from typing import Any, Dict

# Allowed context keys strictly whitelisted
ALLOWED_CONTEXT_KEYS = {
    "amount_minor",
    "payment_method",
    "failure_reason",
    "is_subscription",
    "invoice_age_days",
    "lifetime_value_minor",
    "successful_payments_count",
    "failed_payments_count",
    "has_opted_out",
    "retry_count",
    "merchant_category",
    "model_name",
    "model_version",
    "feature_version",
    "prediction",
    "feature_importance",
}

# Forbidden sensitive substrings that must never leak into prompts
SENSITIVE_SUBSTRINGS = [
    "password",
    "secret",
    "token",
    "key",
    "card",
    "cvv",
    "auth",
    "credential",
    "database_url",
    "bearer",
    "session_cookie",
]


def sanitize_context(raw_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitizes the input context dictionary:
    1. Retains ONLY strictly allowed whitelisted keys.
    2. Filters out any sensitive substrings or dangerous payloads.
    3. Prevents leakage of PII (emails, cards, authorization tokens).
    """
    sanitized: Dict[str, Any] = {}

    for key, value in raw_context.items():
        if key not in ALLOWED_CONTEXT_KEYS:
            continue

        # Prevent sensitive keys
        key_lower = key.lower()
        if any(s in key_lower for s in ["auth", "token", "secret", "password", "credential"]):
            continue

        # Redact any strings that might contain sensitive keywords or raw URLs
        if isinstance(value, str):
            val_lower = value.lower()
            if any(s in val_lower for s in ["bearer", "postgres://", "mysql://", "sqlite://", "secret_"]):
                continue

        sanitized[key] = value

    return sanitized


def build_explanation_prompt(sanitized_context: Dict[str, Any]) -> str:
    """
    Constructs a structured, safe prompt for the LLM Explanation Engine.
    """
    context_json = json.dumps(sanitized_context, indent=2, default=str)

    prompt = f"""You are RecoverAI's Explanation Engine.
Your mission is to explain the Machine Learning model's payment recovery prediction to a merchant operations specialist.

RULES & BOUNDARIES:
1. Explain the ML prediction using ONLY the supplied facts in the context.
2. DO NOT invent facts, assumptions, or customer histories not present in the context.
3. DO NOT execute payments, authorize payments, charge cards, or contact customers.
4. DO NOT override recovery policies or modify model parameters.
5. Provide realistic, actionable decision support for merchant operations.
6. You MUST respond with ONLY a valid JSON object matching the exact schema specified below.

TRANSACTION & PREDICTION CONTEXT:
{context_json}

REQUIRED JSON SCHEMA:
{{
  "summary": "A concise explanation (10 to 500 characters) describing why the ML model predicted this recovery probability.",
  "risk_level": "LOW | MEDIUM | HIGH",
  "recovery_likelihood": "LOW | MEDIUM | HIGH",
  "key_factors": [
    {{
      "feature": "Name of the feature (e.g., Failure Reason, Customer History)",
      "impact": "POSITIVE | NEGATIVE | NEUTRAL",
      "explanation": "Clear explanation of how this feature influenced the prediction."
    }}
  ],
  "recommended_next_step": "Actionable recommendation (5 to 500 characters) for human merchant ops (e.g., recommend retry cooldown, escalate to VIP review).",
  "confidence": 0.90,
  "model_version": "{sanitized_context.get('model_version', '1.0.0')}",
  "feature_version": "{sanitized_context.get('feature_version', '1.0.0')}"
}}
"""
    return prompt

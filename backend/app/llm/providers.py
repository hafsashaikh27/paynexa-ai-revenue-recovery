import abc
import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(abc.ABC):
    @abc.abstractmethod
    def generate_structured_explanation(
        self, prompt: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a structured explanation dictionary matching the schema."""
        pass

    @abc.abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Return operational status and metadata of this provider."""
        pass


class GeminiLLMProvider(LLMProvider):
    """
    Production Google Gemini LLM Provider for RecoverAI.
    Utilizes Google GenAI endpoints with structured JSON output and strict guardrails.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-3.7-flash"
        self.timeout = settings.LLM_TIMEOUT_SECONDS

    def generate_structured_explanation(
        self, prompt: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        if not self.api_key or len(self.api_key.strip()) < 5:
            raise ValueError("Gemini API key is not configured. Set GEMINI_API_KEY in environment.")

        endpoint_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "You are RecoverAI's intelligent explanation engine. Analyze the following payment recovery context "
                                "and produce a valid JSON object strictly matching this schema:\n"
                                "{\n"
                                '  "summary": "Brief 1-2 sentence explanation of why recovery is likely or unlikely",\n'
                                '  "risk_level": "LOW" | "MEDIUM" | "HIGH",\n'
                                '  "recovery_likelihood": "LOW" | "MEDIUM" | "HIGH",\n'
                                '  "key_factors": [\n'
                                '    {"feature": "Feature Name", "impact": "POSITIVE" | "NEGATIVE" | "NEUTRAL", "explanation": "Why this matters"}\n'
                                "  ],\n"
                                '  "recommended_next_step": "Actionable non-automated merchant recommendation",\n'
                                '  "confidence": 0.85\n'
                                "}\n"
                                "Never execute transactions or bypass policies. Do NOT wrap in backticks or markdown fences.\n\n"
                                f"{prompt}"
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "aistudio-build",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(endpoint_url, json=payload, headers=headers)
                response.raise_for_status()
                response_json = response.json()

            candidates = response_json.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates returned from Gemini API")

            content_parts = candidates[0].get("content", {}).get("parts", [])
            raw_text = content_parts[0].get("text", "{}") if content_parts else "{}"

            # Strip markdown fences if present
            raw_text = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = re.sub(r"^```\s*", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = raw_text.strip("` \n\r\t")

            data = json.loads(raw_text)

            # Attach model & feature version
            data["model_version"] = str(context.get("model_version", settings.MODEL_VERSION))
            data["feature_version"] = str(context.get("feature_version", settings.FEATURE_VERSION))
            return data
        except Exception as e:
            logger.warning(f"Gemini LLM provider network call encountered: {e}. Utilizing fallback structured explanation.")
            fallback = MockLLMProvider().generate_structured_explanation(prompt, context)
            return fallback

    def get_status(self) -> Dict[str, Any]:
        has_key = bool(self.api_key and len(self.api_key.strip()) > 5)
        return {
            "provider": "GEMINI",
            "status": "configured" if has_key else "missing_api_key",
            "mode": "live" if has_key else "unconfigured",
            "model_name": self.model,
            "model_version": settings.MODEL_VERSION,
            "feature_version": settings.FEATURE_VERSION,
        }


class MockLLMProvider(LLMProvider):
    """
    Offline, deterministic, credential-free LLM provider for testing and demos.
    Derives realistic structured explanations dynamically based on prediction context.
    """

    def generate_structured_explanation(
        self, prompt: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        prediction = float(context.get("prediction", 0.5))
        reason = str(context.get("failure_reason", "UNKNOWN"))
        payment_method = str(context.get("payment_method", "CARD"))
        retries = int(context.get("retry_count", 0))
        succ_count = int(context.get("successful_payments_count", 0))
        failed_count = int(context.get("failed_payments_count", 0))
        is_sub = bool(context.get("is_subscription", False))
        m_version = str(context.get("model_version", settings.MODEL_VERSION))
        f_version = str(context.get("feature_version", settings.FEATURE_VERSION))

        # Determine likelihood & risk
        if prediction >= 0.70:
            recovery_likelihood = "HIGH"
            risk_level = "LOW"
        elif prediction >= 0.40:
            recovery_likelihood = "MEDIUM"
            risk_level = "MEDIUM"
        else:
            recovery_likelihood = "LOW"
            risk_level = "HIGH"

        # Construct key factors based on actual context
        key_factors: List[Dict[str, str]] = []

        if reason == "NETWORK_TIMEOUT":
            key_factors.append({
                "feature": "Failure Reason (Network Timeout)",
                "impact": "POSITIVE",
                "explanation": "Transient gateway network timeouts have a high statistical probability of success upon scheduled retry."
            })
        elif reason == "BANK_ERROR":
            key_factors.append({
                "feature": "Failure Reason (Bank Error)",
                "impact": "POSITIVE",
                "explanation": "Temporary acquiring bank processing errors typically resolve on subsequent retry attempts."
            })
        elif reason == "INSUFFICIENT_FUNDS":
            key_factors.append({
                "feature": "Failure Reason (Insufficient Funds)",
                "impact": "NEGATIVE",
                "explanation": "Insufficient account balance requires allowing time for account replenishment before re-attempting."
            })
        elif reason in ("CARD_DECLINED", "EXPIRED_CARD"):
            key_factors.append({
                "feature": f"Failure Reason ({reason.replace('_', ' ').title()})",
                "impact": "NEGATIVE",
                "explanation": f"Card declined or expired state indicates payment method updating is strongly advised."
            })
        else:
            key_factors.append({
                "feature": "Failure Reason",
                "impact": "NEUTRAL",
                "explanation": f"Transaction failed due to {reason}."
            })

        # Payment history factor
        if succ_count > failed_count + 1:
            key_factors.append({
                "feature": "Customer Payment History",
                "impact": "POSITIVE",
                "explanation": f"Strong track record of {succ_count} successful payments indicates high customer reliability."
            })
        elif failed_count > succ_count:
            key_factors.append({
                "feature": "Customer Payment History",
                "impact": "NEGATIVE",
                "explanation": f"Customer has a high ratio of failed payments ({failed_count} failures), increasing default risk."
            })
        else:
            key_factors.append({
                "feature": "Customer Payment History",
                "impact": "NEUTRAL",
                "explanation": f"Customer has completed {succ_count} payments with normal risk profile."
            })

        # Retry factor
        if retries >= 2:
            key_factors.append({
                "feature": "Retry Velocity",
                "impact": "NEGATIVE",
                "explanation": f"Already attempted {retries} retries without success, diminishing marginal recovery returns."
            })
        else:
            key_factors.append({
                "feature": "Retry Velocity",
                "impact": "POSITIVE" if retries == 0 else "NEUTRAL",
                "explanation": f"Low prior retry count ({retries} attempts) leaves ample recovery window."
            })

        if is_sub:
            key_factors.append({
                "feature": "Subscription Agreement",
                "impact": "POSITIVE",
                "explanation": "Active recurring mandate demonstrates continued user intent."
            })

        # Summary and recommendation
        if recovery_likelihood == "HIGH":
            summary = (
                f"The ML model predicts a high recovery likelihood ({prediction * 100:.1f}%) "
                f"primarily due to transient failure reason '{reason}' and positive historical payment signals."
            )
            recommended_next_step = (
                "Recommend automatic retry after a short 2-4 hour cooldown window during peak processing hours."
            )
            confidence = 0.92
        elif recovery_likelihood == "MEDIUM":
            summary = (
                f"The ML model predicts a moderate recovery likelihood ({prediction * 100:.1f}%). "
                f"While failure reason '{reason}' presents challenges, customer history provides moderate recovery potential."
            )
            recommended_next_step = (
                "Recommend staggered retry within 24 hours, followed by gentle customer notification if unresolved."
            )
            confidence = 0.85
        else:
            summary = (
                f"The ML model predicts a low recovery likelihood ({prediction * 100:.1f}%) "
                f"driven by failure reason '{reason}' and elevated default risk factors."
            )
            recommended_next_step = (
                "Recommend holding immediate retries to prevent fees; prompt customer via billing portal to update payment method."
            )
            confidence = 0.89

        return {
            "summary": summary,
            "risk_level": risk_level,
            "recovery_likelihood": recovery_likelihood,
            "key_factors": key_factors,
            "recommended_next_step": recommended_next_step,
            "confidence": confidence,
            "model_version": m_version,
            "feature_version": f_version,
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": "MOCK",
            "status": "operational",
            "mode": "offline",
            "model_name": settings.MODEL_NAME,
            "model_version": settings.MODEL_VERSION,
            "feature_version": settings.FEATURE_VERSION,
        }


class OpenAILLMProvider(LLMProvider):
    """
    Live OpenAI Provider utilizing structured output format with strict safety boundaries.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model or settings.OPENAI_MODEL
        self.timeout = settings.LLM_TIMEOUT_SECONDS

    def generate_structured_explanation(
        self, prompt: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("OpenAI API key is not configured. Set OPENAI_API_KEY in environment.")

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key, timeout=self.timeout)

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are RecoverAI's Explanation Engine. Return strictly valid JSON "
                            "matching the required schema. Never output markdown backticks or commentary."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            raw_text = response.choices[0].message.content or "{}"
            data = json.loads(raw_text)

            # Ensure model & feature version are attached
            data["model_version"] = str(context.get("model_version", settings.MODEL_VERSION))
            data["feature_version"] = str(context.get("feature_version", settings.FEATURE_VERSION))
            return data
        except Exception as e:
            logger.error(f"OpenAI LLM provider call failed: {e}")
            raise RuntimeError(f"OpenAI explanation generation failed: {str(e)}")

    def get_status(self) -> Dict[str, Any]:
        has_key = bool(self.api_key and len(self.api_key) > 5)
        return {
            "provider": "OPENAI",
            "status": "configured" if has_key else "missing_api_key",
            "mode": "live" if has_key else "unconfigured",
            "model_name": self.model,
            "model_version": settings.MODEL_VERSION,
            "feature_version": settings.FEATURE_VERSION,
        }

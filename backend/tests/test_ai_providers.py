import json
from types import SimpleNamespace

from google.genai.errors import APIError as GeminiAPIError

from app.services.ai import ExceptionAnalyzer


FINDING = {
    "severity": "high",
    "explanation": "The worker currency does not match the configured country.",
    "recommendation": "Hold the payment and verify the worker record.",
}


def gemini_settings():
    return SimpleNamespace(
        ai_provider="gemini",
        gemini_api_key="test-key",
        gemini_model="gemini-test-model",
        openai_api_key="",
        openai_model="unused",
    )


def test_gemini_structured_analysis_records_provenance(monkeypatch):
    payload = {
        "severity": "high",
        "explanation": "The currency conflicts with the worker's country policy.",
        "recommendation": "Pause payment and verify the employing entity.",
        "policy_citation": "United Kingdom Payroll Guide - Payment currency",
        "confidence": 0.94,
    }

    class FakeModels:
        def generate_content(self, **_kwargs):
            return SimpleNamespace(text=json.dumps(payload))

    monkeypatch.setattr(
        "app.services.ai.genai.Client",
        lambda **_kwargs: SimpleNamespace(models=FakeModels()),
    )
    analyzer = ExceptionAnalyzer()
    analyzer.settings = gemini_settings()

    result = analyzer.analyze(FINDING, "United Kingdom Payroll Guide - Payment currency")

    assert result.confidence == 0.94
    assert analyzer.provider == "gemini"
    assert analyzer.model == "gemini-test-model"
    assert analyzer.fallback_reason is None


def test_gemini_api_failure_uses_audited_deterministic_fallback(monkeypatch):
    class FailingModels:
        def generate_content(self, **_kwargs):
            raise GeminiAPIError(429, {"message": "quota unavailable"})

    monkeypatch.setattr(
        "app.services.ai.genai.Client",
        lambda **_kwargs: SimpleNamespace(models=FailingModels()),
    )
    analyzer = ExceptionAnalyzer()
    analyzer.settings = gemini_settings()

    result = analyzer.analyze(FINDING, "Global Payroll Controls - Currency")

    assert result.confidence == 0.97
    assert analyzer.provider == "mock-fallback"
    assert analyzer.model == "deterministic-demo"
    assert analyzer.fallback_reason == "APIError"

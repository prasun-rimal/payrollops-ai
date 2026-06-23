import json

from google import genai
from google.genai import types
from google.genai.errors import APIError as GeminiAPIError
from openai import APIError as OpenAIAPIError, OpenAI

from app.config import get_settings
from app.models import Severity
from app.schemas import ExceptionAnalysis


class ExceptionAnalyzer:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.provider = "mock"
        self.model = "deterministic-demo"
        self.fallback_reason: str | None = None

    def analyze(self, finding: dict, policy_context: str) -> ExceptionAnalysis:
        if self.settings.ai_provider == "gemini" and self.settings.gemini_api_key:
            try:
                client = genai.Client(api_key=self.settings.gemini_api_key)
                response = client.models.generate_content(
                    model=self.settings.gemini_model,
                    contents=json.dumps({"finding": finding, "policy_context": policy_context}, default=str),
                    config=types.GenerateContentConfig(
                        system_instruction=(
                            "You are a payroll operations risk analyst. Use only the supplied policy context. "
                            "Return a concise, operational analysis. Never invent legal requirements."
                        ),
                        response_mime_type="application/json",
                        response_schema=ExceptionAnalysis,
                        thinking_config=types.ThinkingConfig(thinking_level="low"),
                    ),
                )
                if not response.text:
                    raise RuntimeError("Gemini returned no structured analysis")
                self.provider = "gemini"
                self.model = self.settings.gemini_model
                self.fallback_reason = None
                return ExceptionAnalysis.model_validate_json(response.text)
            except GeminiAPIError as exc:
                self.provider = "mock-fallback"
                self.model = "deterministic-demo"
                self.fallback_reason = type(exc).__name__
                return self._mock_analysis(finding, policy_context)

        if self.settings.ai_provider != "openai" or not self.settings.openai_api_key:
            self.provider = "mock"
            self.model = "deterministic-demo"
            self.fallback_reason = None
            return self._mock_analysis(finding, policy_context)

        try:
            client = OpenAI(api_key=self.settings.openai_api_key)
            response = client.responses.parse(
                model=self.settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": (
                            "You are a payroll operations risk analyst. Use only the supplied policy context. "
                            "Return a concise, operational analysis. Never invent legal requirements."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps({"finding": finding, "policy_context": policy_context}, default=str),
                    },
                ],
                text_format=ExceptionAnalysis,
            )
            if response.output_parsed is None:
                raise RuntimeError("The AI provider returned no structured analysis")
            self.provider = "openai"
            self.model = self.settings.openai_model
            self.fallback_reason = None
            return response.output_parsed
        except OpenAIAPIError as exc:
            self.provider = "mock-fallback"
            self.model = "deterministic-demo"
            self.fallback_reason = type(exc).__name__
            return self._mock_analysis(finding, policy_context)

    @staticmethod
    def _mock_analysis(finding: dict, policy_context: str) -> ExceptionAnalysis:
        severity = Severity(finding["severity"])
        citation = policy_context.splitlines()[0] if policy_context else "Global Payroll Controls, Review Requirements"
        return ExceptionAnalysis(
            severity=severity,
            explanation=finding["explanation"],
            recommendation=finding["recommendation"],
            policy_citation=citation,
            confidence=0.97 if severity in {Severity.critical, Severity.high} else 0.91,
        )

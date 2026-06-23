import json

from openai import OpenAI

from app.config import get_settings
from app.models import Severity
from app.schemas import ExceptionAnalysis


class ExceptionAnalyzer:
    def __init__(self) -> None:
        self.settings = get_settings()

    def analyze(self, finding: dict, policy_context: str) -> ExceptionAnalysis:
        if self.settings.ai_provider != "openai" or not self.settings.openai_api_key:
            return self._mock_analysis(finding, policy_context)

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
                    "content": json.dumps({"finding": finding, "policy_context": policy_context}),
                },
            ],
            text_format=ExceptionAnalysis,
        )
        if response.output_parsed is None:
            raise RuntimeError("The AI provider returned no structured analysis")
        return response.output_parsed

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


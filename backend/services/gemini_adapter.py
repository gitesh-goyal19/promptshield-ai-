"""Gemini adapter using the official google-genai Python SDK."""

import time
import os

from google.genai import Client
from google.genai import types

from services.adapter import ModelAdapter, GenerationResult


class GeminiAdapter(ModelAdapter):
    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model or os.getenv("GEMINI_TARGET_MODEL", "gemini-1.5-flash")
        self._client = None
        if not self.api_key:
            self._client = None
        else:
            try:
                self._client = Client(api_key=self.api_key)
            except Exception:
                self._client = None

    @property
    def configured(self) -> bool:
        return self._client is not None and bool(self.api_key)

    def generate(self, system_prompt: str, user_prompt: str, settings: dict) -> GenerationResult:
        start = time.time()
        if not self.configured:
            return GenerationResult(
                text="",
                model=self.model,
                provider=self.provider_name,
                latency_ms=0,
                error="Gemini API key is not configured on the backend.",
            )

        temperature = float(settings.get("temperature", 0.7) or 0.7)
        max_tokens = int(settings.get("max_output_tokens", 1000) or 1000)

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=config,
            )
            text = response.text or ""
            blocked = False
            error = None
        except Exception as exc:
            text = ""
            error = str(exc)
            blocked = self._is_safety_block(exc)

        latency_ms = int((time.time() - start) * 1000)
        return GenerationResult(
            text=text,
            model=self.model,
            provider=self.provider_name,
            latency_ms=latency_ms,
            error=error,
            blocked=blocked,
        )

    @staticmethod
    def _is_safety_block(exc: Exception) -> bool:
        msg = str(exc).lower()
        return any(
            token in msg
            for token in [
                "safety",
                "blocked",
                "finish_reason",
                "prohibited",
            ]
        )

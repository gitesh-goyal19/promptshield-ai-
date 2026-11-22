"""Provider abstraction for AI model adapters.

All model calls happen on the backend only. The API key never reaches the browser.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class GenerationResult:
    text: str
    model: str
    provider: str
    latency_ms: int
    error: Optional[str] = None
    blocked: bool = False


class ModelAdapter(ABC):
    """Interface for AI model providers.

    implement generate(system_prompt, user_prompt, settings) -> GenerationResult
    """

    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str, settings: dict) -> GenerationResult:
        raise NotImplementedError

    @property
    @abstractmethod
    def provider_name(self) -> str:
        raise NotImplementedError

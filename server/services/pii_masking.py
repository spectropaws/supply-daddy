"""
PII Masking Middleware — Mask & Map pattern.

Replaces sensitive identifiers with tokens before sending to GenAI,
then restores them in the response.
"""

import re
from typing import Any


# Common PII patterns
_PII_PATTERNS = [
    (r'\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b', "ENTITY"),       # Proper names
    (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', "PHONE"),             # Phone numbers
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', "EMAIL"),
    (r'\b\d{1,5}\s\w+(?:\s\w+)*\s(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct)\b', "ADDRESS"),
]


class PIIMasker:
    """Mask PII tokens in text and provide an unmasking map."""

    def __init__(self):
        self._map: dict[str, str] = {}
        self._reverse_map: dict[str, str] = {}
        self._counter: dict[str, int] = {}

    def _get_token(self, category: str) -> str:
        count = self._counter.get(category, 0)
        self._counter[category] = count + 1
        suffix = chr(65 + count)  # A, B, C...
        return f"[{category}_{suffix}]"

    def mask_text(self, text: str, extra_entities: list[str] | None = None) -> str:
        """Replace PII in text with tokens. Also masks any extra_entities provided."""
        masked = text

        # Mask explicitly provided entities first (company names, etc.)
        if extra_entities:
            for entity in sorted(extra_entities, key=len, reverse=True):
                if entity and entity in masked:
                    token = self._get_token("VENDOR")
                    self._map[token] = entity
                    self._reverse_map[entity] = token
                    masked = masked.replace(entity, token)

        # Mask regex-detected PII
        for pattern, category in _PII_PATTERNS:
            for match in re.finditer(pattern, masked):
                value = match.group()
                if value.startswith("[") and value.endswith("]"):
                    continue  # already masked
                if value not in self._reverse_map:
                    token = self._get_token(category)
                    self._map[token] = value
                    self._reverse_map[value] = token
                masked = masked.replace(value, self._reverse_map.get(value, value))

        return masked

    def unmask_text(self, text: str) -> str:
        """Restore all masked tokens back to original values."""
        result = text
        for token, original in self._map.items():
            result = result.replace(token, original)
        return result

    def unmask_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively unmask all string values in a dict."""
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self.unmask_text(value)
            elif isinstance(value, dict):
                result[key] = self.unmask_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self.unmask_text(v) if isinstance(v, str) else v
                    for v in value
                ]
            else:
                result[key] = value
        return result

    @property
    def mapping(self) -> dict[str, str]:
        return dict(self._map)

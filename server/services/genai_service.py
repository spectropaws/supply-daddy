"""
GenAI Service — MegaLLM integration for:
1. Shipment document classification/reconciliation
2. Anomaly interpretation
"""

import json
import os
import logging

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False
    logger.warning("openai not installed — using stub responses")


def _get_client():
    """Create MegaLLM client via OpenAI SDK."""
    if not _HAS_GENAI:
        return None
    api_key = os.getenv("MEGALLM_API_KEY", "")
    if not api_key or api_key == "your_megallm_api_key_here":
        logger.warning("MEGALLM_API_KEY not set — using stub responses")
        return None
    
    return OpenAI(
        base_url="https://ai.megallm.io/v1",
        api_key=api_key
    )


def _parse_json_response(text: str) -> dict:
    """Extract JSON from response (handles markdown code fences)."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first and last lines (code fences)
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw_response": text, "parse_error": True}


async def classify_shipment(
    po_text: str,
    invoice_text: str,
    bol_text: str,
) -> dict:
    """
    Semantic reconciliation of shipment documents.
    Returns product category, risk flags, compliance requirements.
    """
    client = _get_client()

    if client is None:
        return {
            "product_category": "pharmaceutical",
            "risk_flags": ["temperature_sensitive"],
            "hazard_class": None,
            "compliance_required": ["cold_chain"],
            "confidence_score": 0.91,
        }

    prompt = f"""You are a supply chain compliance auditor. Analyze the following shipping documents and classify the shipment.

== PURCHASE ORDER ==
{po_text}

== INVOICE ==
{invoice_text}

== BILL OF LADING ==
{bol_text}

Respond ONLY with a JSON object in this exact format, no markdown formatting or extra text:
{{
  "product_category": "<one of: pharmaceutical, food_grain, lithium_battery, electronics, or a custom category>",
  "risk_flags": ["<list of risk flags like temperature_sensitive, fragile, hazardous>"],
  "hazard_class": "<hazard class or null>",
  "compliance_required": ["<list of compliance requirements like cold_chain, hazmat_cert>"],
  "confidence_score": <0.0 to 1.0>
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        return _parse_json_response(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"MegaLLM classification error: {e}")
        return {
            "product_category": "default",
            "risk_flags": [],
            "hazard_class": None,
            "compliance_required": [],
            "confidence_score": 0.0,
            "error": str(e),
        }


async def interpret_anomaly(anomaly_context: dict) -> dict:
    """
    Generate a business-context interpretation of a detected anomaly.
    """
    client = _get_client()

    if client is None:
        return {
            "risk_assessment": f"Anomaly {anomaly_context.get('anomaly', 'UNKNOWN')} detected — "
                              f"potential compliance violation for {anomaly_context.get('product_category', 'unknown')} shipment.",
            "business_impact": "Shipment may require inspection or rerouting. "
                              "Downstream delivery schedules may be affected.",
            "recommended_action": "Hold shipment at current node for inspection. "
                                 "Notify quality assurance team.",
            "severity_level": "HIGH",
        }

    prompt = f"""You are a supply chain risk analyst. Analyze the following anomaly event and provide a business impact assessment.

Anomaly Context:
{json.dumps(anomaly_context, indent=2)}

Respond ONLY with a JSON object in this exact format, no markdown formatting or extra text:
{{
  "risk_assessment": "<detailed risk assessment>",
  "business_impact": "<business impact description>",
  "recommended_action": "<recommended action to take>",
  "severity_level": "<one of: LOW, MEDIUM, HIGH, CRITICAL>"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        return _parse_json_response(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"MegaLLM anomaly interpretation error: {e}")
        return {
            "risk_assessment": "Unable to generate AI assessment.",
            "business_impact": "Unknown",
            "recommended_action": "Manual review required.",
            "severity_level": "MEDIUM",
            "error": str(e),
        }

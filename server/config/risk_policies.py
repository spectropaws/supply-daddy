"""
Deterministic risk policies keyed by product category.
Used by risk_engine.py to evaluate checkpoint telemetry.
"""

RISK_POLICIES: dict = {
    "pharmaceutical": {
        "temperature_range": (2, 8),
        "max_delay_hours": 6,
        "weight_tolerance_pct": 2,
        "humidity_max_pct": 60,
    },
    "food_grain": {
        "temperature_range": (10, 35),
        "moisture_max_pct": 14,
        "max_delay_hours": 24,
        "weight_tolerance_pct": 5,
    },
    "lithium_battery": {
        "temperature_range": (-10, 30),
        "hazmat_required": True,
        "max_delay_hours": 12,
        "weight_tolerance_pct": 1,
    },
    "electronics": {
        "temperature_range": (0, 40),
        "humidity_max_pct": 70,
        "max_delay_hours": 48,
        "weight_tolerance_pct": 3,
    },
    "default": {
        "temperature_range": (-20, 50),
        "max_delay_hours": 72,
        "weight_tolerance_pct": 10,
    },
}


def get_policy(product_category: str) -> dict:
    """Get risk policy for a product category, falling back to default."""
    return RISK_POLICIES.get(product_category, RISK_POLICIES["default"])

"""
ETA Ripple Effect Engine — Propagates delays across remaining route nodes.

When a delay is detected at a node, all downstream ETAs are shifted by the delta.
This runs entirely off-chain.
"""

from datetime import timedelta


def propagate_delay(
    route: list[dict],
    node_index: int,
    delay_hours: float,
) -> list[dict]:
    """
    Shift ETAs for all remaining nodes after node_index by delay_hours.

    Args:
        route: list of route node dicts with 'eta' keys (ISO format strings or None)
        node_index: index of the node where delay was detected
        delay_hours: positive float, hours of delay

    Returns:
        Updated route with shifted ETAs
    """
    delta = timedelta(hours=delay_hours)

    for i in range(node_index + 1, len(route)):
        node = route[i]
        if node.get("eta"):
            # Parse ISO format, add delta, write back
            from datetime import datetime
            try:
                eta = datetime.fromisoformat(node["eta"])
                node["eta"] = (eta + delta).isoformat()
            except (ValueError, TypeError):
                pass  # skip nodes with bad ETA data
        if node.get("expected_arrival"):
            from datetime import datetime
            try:
                ea = datetime.fromisoformat(node["expected_arrival"])
                node["expected_arrival"] = (ea + delta).isoformat()
            except (ValueError, TypeError):
                pass

    return route

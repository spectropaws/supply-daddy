"""
Route Graph — Indian logistics transit network with Dijkstra pathfinding.

Provides optimal route generation between any two nodes in the network.
"""

import heapq
from datetime import datetime, timedelta, timezone

# ─── Synthetic Transit Node Network ──────────────────────
NODES: dict[str, dict] = {
    "DEL": {"name": "Delhi Hub", "x": 350, "y": 80},
    "JAI": {"name": "Jaipur Hub", "x": 230, "y": 160},
    "LKO": {"name": "Lucknow Hub", "x": 490, "y": 120},
    "KNP": {"name": "Kanpur Hub", "x": 440, "y": 200},
    "AMD": {"name": "Ahmedabad Hub", "x": 140, "y": 310},
    "BPL": {"name": "Bhopal Hub", "x": 340, "y": 310},
    "KOL": {"name": "Kolkata Hub", "x": 620, "y": 340},
    "MUM": {"name": "Mumbai Hub", "x": 110, "y": 440},
    "PNQ": {"name": "Pune Hub", "x": 170, "y": 510},
    "NAG": {"name": "Nagpur Hub", "x": 390, "y": 400},
    "HYD": {"name": "Hyderabad Hub", "x": 340, "y": 530},
    "BBI": {"name": "Bhubaneswar Hub", "x": 560, "y": 470},
    "VTZ": {"name": "Visakhapatnam Hub", "x": 480, "y": 540},
    "BLR": {"name": "Bangalore Hub", "x": 290, "y": 660},
    "CHN": {"name": "Chennai Hub", "x": 410, "y": 670},
}

# (node_a, node_b, travel_hours)
EDGES: list[tuple[str, str, float]] = [
    ("DEL", "JAI", 5),
    ("DEL", "LKO", 9),
    ("DEL", "KNP", 8),
    ("JAI", "AMD", 10),
    ("JAI", "BPL", 11),
    ("LKO", "KNP", 3),
    ("LKO", "KOL", 15),
    ("KNP", "BPL", 9),
    ("AMD", "MUM", 8),
    ("MUM", "PNQ", 3),
    ("PNQ", "BLR", 14),
    ("BPL", "NAG", 6),
    ("NAG", "HYD", 8),
    ("NAG", "KOL", 13),
    ("HYD", "BLR", 10),
    ("HYD", "VTZ", 9),
    ("BLR", "CHN", 6),
    ("CHN", "VTZ", 12),
    ("VTZ", "BBI", 7),
    ("BBI", "KOL", 8),
    ("MUM", "HYD", 13),
    ("PNQ", "HYD", 10),
]


def _build_adjacency() -> dict[str, list[tuple[str, float]]]:
    adj: dict[str, list[tuple[str, float]]] = {code: [] for code in NODES}
    for a, b, hours in EDGES:
        adj[a].append((b, hours))
        adj[b].append((a, hours))
    return adj


def find_optimal_route(origin: str, destination: str) -> list[dict] | None:
    """
    Dijkstra's shortest path from origin to destination.
    Returns list of RouteNode dicts with ETAs, or None if no path exists.
    """
    if origin not in NODES or destination not in NODES:
        return None
    if origin == destination:
        return [{
            "location_code": origin,
            "name": NODES[origin]["name"],
            "expected_arrival": datetime.now(timezone.utc).isoformat(),
            "eta": datetime.now(timezone.utc).isoformat(),
            "actual_arrival": None,
        }]

    adj = _build_adjacency()
    dist: dict[str, float] = {code: float("inf") for code in NODES}
    prev: dict[str, str | None] = {code: None for code in NODES}
    dist[origin] = 0
    pq = [(0.0, origin)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        if u == destination:
            break
        for v, w in adj[u]:
            new_dist = dist[u] + w
            if new_dist < dist[v]:
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(pq, (new_dist, v))

    # No path found
    if dist[destination] == float("inf"):
        return None

    # Reconstruct path
    path: list[str] = []
    node: str | None = destination
    while node is not None:
        path.append(node)
        node = prev[node]
    path.reverse()

    # Build route nodes with cumulative ETAs
    now = datetime.now(timezone.utc)
    route: list[dict] = []
    cumulative_hours = 0.0

    for i, code in enumerate(path):
        if i > 0:
            # Find edge weight between path[i-1] and path[i]
            for a, b, hours in EDGES:
                if (a == path[i - 1] and b == code) or (b == path[i - 1] and a == code):
                    cumulative_hours += hours
                    break
        eta = now + timedelta(hours=cumulative_hours)
        route.append({
            "location_code": code,
            "name": NODES[code]["name"],
            "expected_arrival": eta.isoformat(),
            "eta": eta.isoformat(),
            "actual_arrival": None,
        })

    return route


def get_all_nodes() -> list[dict]:
    """Return all nodes with metadata for frontend display."""
    return [
        {"code": code, "name": info["name"], "x": info["x"], "y": info["y"]}
        for code, info in NODES.items()
    ]


def get_graph_data() -> dict:
    """Return full graph data (nodes + edges) for ReactFlow visualization."""
    nodes = [
        {
            "id": code,
            "name": info["name"],
            "x": info["x"],
            "y": info["y"],
        }
        for code, info in NODES.items()
    ]
    edges = [
        {
            "source": a,
            "target": b,
            "travel_hours": hours,
            "label": f"{hours}h",
        }
        for a, b, hours in EDGES
    ]
    return {"nodes": nodes, "edges": edges}

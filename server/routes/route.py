"""
Route routes — Transit node graph and optimal path generation.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.route_graph import find_optimal_route, get_all_nodes, get_graph_data

router = APIRouter(prefix="/routes", tags=["Routes"])


class RouteRequest(BaseModel):
    origin: str
    destination: str


@router.get("/nodes", response_model=list[dict])
async def list_nodes():
    """List all available transit nodes in the network."""
    return get_all_nodes()


@router.get("/graph", response_model=dict)
async def get_graph():
    """Get full graph data (nodes + edges) for visualization."""
    return get_graph_data()


@router.post("/optimal", response_model=dict)
async def compute_optimal_route(request: RouteRequest):
    """Compute the optimal route between two nodes using Dijkstra."""
    route = find_optimal_route(request.origin, request.destination)
    if not route:
        raise HTTPException(status_code=400, detail="No route found between these locations")
    return {"route": route}

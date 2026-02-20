"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Shipment } from "../page";
import { apiFetch, API_BASE } from "../lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface GraphData {
    nodes: { id: string; name: string; x: number; y: number }[];
    edges: { source: string; target: string; travel_hours: number; label: string }[];
}

interface Props {
    shipment: Shipment | null;
}

/* Custom node with handles on all 4 sides for clean edge routing */
function TransitNode({ data }: { data: { label: string; code: string; status: string } }) {
    const colorMap: Record<string, string> = {
        visited: "#10b981",
        current: "#3b82f6",
        upcoming: "#64748b",
        default: "#64748b",
    };
    const color = colorMap[data.status] || colorMap.default;
    const isCurrent = data.status === "current";

    const hiddenHandle: React.CSSProperties = { visibility: "hidden", width: 1, height: 1 };

    return (
        <>
            {/* Source handles (edge exits from here) */}
            <Handle type="source" position={Position.Top} id="s-top" style={hiddenHandle} />
            <Handle type="source" position={Position.Bottom} id="s-bottom" style={hiddenHandle} />
            <Handle type="source" position={Position.Left} id="s-left" style={hiddenHandle} />
            <Handle type="source" position={Position.Right} id="s-right" style={hiddenHandle} />
            {/* Target handles (edge enters here) */}
            <Handle type="target" position={Position.Top} id="t-top" style={hiddenHandle} />
            <Handle type="target" position={Position.Bottom} id="t-bottom" style={hiddenHandle} />
            <Handle type="target" position={Position.Left} id="t-left" style={hiddenHandle} />
            <Handle type="target" position={Position.Right} id="t-right" style={hiddenHandle} />
            <div
                style={{
                    background: "hsl(var(--card))",
                    border: `2px solid ${color}`,
                    borderRadius: "12px",
                    padding: "8px 14px",
                    textAlign: "center",
                    minWidth: "80px",
                    boxShadow: isCurrent ? `0 0 16px ${color}55` : "0 2px 8px rgba(0,0,0,0.3)",
                    animation: isCurrent ? "pulse-glow 2s ease-in-out infinite" : "none",
                }}
            >
                <div style={{ fontSize: "11px", fontWeight: 700, color, letterSpacing: "0.5px" }}>
                    {data.code}
                </div>
                <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px", whiteSpace: "nowrap" }}>
                    {data.label}
                </div>
            </div>
        </>
    );
}

/** Pick the best source/target handles based on relative node positions. */
function getHandles(
    srcNode: { x: number; y: number },
    tgtNode: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
    const dx = tgtNode.x - srcNode.x;
    const dy = tgtNode.y - srcNode.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        // Primarily horizontal
        return dx > 0
            ? { sourceHandle: "s-right", targetHandle: "t-left" }
            : { sourceHandle: "s-left", targetHandle: "t-right" };
    }
    // Primarily vertical
    return dy > 0
        ? { sourceHandle: "s-bottom", targetHandle: "t-top" }
        : { sourceHandle: "s-top", targetHandle: "t-bottom" };
}

const nodeTypes: NodeTypes = { transit: TransitNode };

export default function RouteGraph({ shipment }: Props) {
    const [graphData, setGraphData] = useState<GraphData | null>(null);

    useEffect(() => {
        apiFetch(`${API_BASE}/routes/graph`)
            .then((r) => r.json())
            .then(setGraphData)
            .catch(console.error);
    }, []);

    const { flowNodes, flowEdges } = useMemo(() => {
        if (!graphData) return { flowNodes: [], flowEdges: [] };

        const routeCodes = new Set(shipment?.route?.map((n) => n.location_code) || []);

        // Build a DIRECTED map: for each consecutive pair in the route,
        // store the direction so we can orient edges correctly.
        // Key: "A-B" (sorted), Value: { source: A, target: B }
        const routeEdgeDir = new Map<string, { source: string; target: string }>();
        if (shipment?.route) {
            for (let i = 0; i < shipment.route.length - 1; i++) {
                const a = shipment.route[i].location_code;
                const b = shipment.route[i + 1].location_code;
                const key = [a, b].sort().join("-");
                routeEdgeDir.set(key, { source: a, target: b });
            }
        }

        const nodeStatus = (code: string): string => {
            if (!shipment?.route || !routeCodes.has(code)) return "default";
            const node = shipment.route.find((n) => n.location_code === code);
            if (!node) return "default";
            if (node.actual_arrival) return "visited";
            const idx = shipment.route.findIndex((n) => n.location_code === code);
            const prevNode = idx > 0 ? shipment.route[idx - 1] : null;
            if (idx === 0 || (prevNode && prevNode.actual_arrival)) return "current";
            return "upcoming";
        };

        // Build node position lookup (using scaled coords)
        const nodePos = new Map(graphData.nodes.map((n) => [n.id, { x: n.x * 1.3, y: n.y * 1.1 }]));

        const flowNodes: Node[] = graphData.nodes.map((n) => ({
            id: n.id,
            type: "transit",
            position: { x: n.x * 1.3, y: n.y * 1.1 },
            data: { label: n.name.replace(" Hub", ""), code: n.id, status: nodeStatus(n.id) },
        }));

        const flowEdges: Edge[] = graphData.edges.map((e) => {
            const sortedKey = [e.source, e.target].sort().join("-");
            const routeDir = routeEdgeDir.get(sortedKey);
            const isActive = !!routeDir;

            // If this edge is on the active route, orient it in the route's direction
            const source = routeDir ? routeDir.source : e.source;
            const target = routeDir ? routeDir.target : e.target;

            // Pick handles based on relative positions so edges never wrap
            const srcPos = nodePos.get(source) || { x: 0, y: 0 };
            const tgtPos = nodePos.get(target) || { x: 0, y: 0 };
            const handles = getHandles(srcPos, tgtPos);

            return {
                id: `${e.source}-${e.target}`,
                source,
                target,
                sourceHandle: handles.sourceHandle,
                targetHandle: handles.targetHandle,
                label: e.label,
                style: {
                    stroke: isActive ? "#3b82f6" : "hsl(var(--border))",
                    strokeWidth: isActive ? 2.5 : 1,
                },
                labelStyle: {
                    fill: isActive ? "#3b82f6" : "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                },
                animated: isActive,
            };
        });

        return { flowNodes, flowEdges };
    }, [graphData, shipment]);

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    🗺️ Route Network
                    {shipment && (
                        <span className="text-xs font-normal text-cyan-400">
                            {shipment.shipment_id}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[420px] rounded-lg overflow-hidden bg-background">
                    {flowNodes.length > 0 ? (
                        <ReactFlow
                            nodes={flowNodes}
                            edges={flowEdges}
                            nodeTypes={nodeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.2 }}
                            proOptions={{ hideAttribution: true }}
                            style={{ background: "hsl(var(--background))" }}
                        >
                            <Background color="hsl(var(--border))" gap={24} size={1} />
                            <Controls
                                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                            />
                            <MiniMap
                                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                                nodeColor="#3b82f6"
                                maskColor="rgba(0,0,0,0.5)"
                            />
                        </ReactFlow>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading network graph...
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

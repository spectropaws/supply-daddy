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

/* Custom node — kept with inline styles for ReactFlow compatibility */
function TransitNode({ data }: { data: { label: string; code: string; status: string } }) {
    const colorMap: Record<string, string> = {
        visited: "#10b981",
        current: "#3b82f6",
        upcoming: "#64748b",
        default: "#64748b",
    };
    const color = colorMap[data.status] || colorMap.default;
    const isCurrent = data.status === "current";

    return (
        <>
            <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
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
            <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
        </>
    );
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
        const routeEdgeKeys = new Set<string>();

        if (shipment?.route) {
            for (let i = 0; i < shipment.route.length - 1; i++) {
                const a = shipment.route[i].location_code;
                const b = shipment.route[i + 1].location_code;
                routeEdgeKeys.add(`${a}-${b}`);
                routeEdgeKeys.add(`${b}-${a}`);
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

        const flowNodes: Node[] = graphData.nodes.map((n) => ({
            id: n.id,
            type: "transit",
            position: { x: n.x * 1.3, y: n.y * 1.1 },
            data: { label: n.name.replace(" Hub", ""), code: n.id, status: nodeStatus(n.id) },
        }));

        const flowEdges: Edge[] = graphData.edges.map((e) => {
            const isActive = routeEdgeKeys.has(`${e.source}-${e.target}`);
            return {
                id: `${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
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

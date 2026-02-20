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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GraphData {
    nodes: { id: string; name: string; x: number; y: number }[];
    edges: { source: string; target: string; travel_hours: number; label: string }[];
}

interface Props {
    shipment: Shipment | null;
}

/* Custom node */
function TransitNode({ data }: { data: { label: string; code: string; status: string } }) {
    const colorMap: Record<string, string> = {
        visited: "var(--accent-green)",
        current: "var(--accent-blue)",
        upcoming: "var(--text-muted)",
        default: "var(--text-muted)",
    };
    const color = colorMap[data.status] || colorMap.default;
    const isCurrent = data.status === "current";

    return (
        <>
            <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
            <div
                style={{
                    background: "var(--bg-card)",
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
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px", whiteSpace: "nowrap" }}>
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
        fetch(`${API_BASE}/routes/graph`)
            .then((r) => r.json())
            .then(setGraphData)
            .catch(console.error);
    }, []);

    const { flowNodes, flowEdges } = useMemo(() => {
        if (!graphData) return { flowNodes: [], flowEdges: [] };

        const routeCodes = new Set(shipment?.route?.map((n) => n.location_code) || []);
        const routeEdgeKeys = new Set<string>();

        // Build set of edges in the active route
        if (shipment?.route) {
            for (let i = 0; i < shipment.route.length - 1; i++) {
                const a = shipment.route[i].location_code;
                const b = shipment.route[i + 1].location_code;
                routeEdgeKeys.add(`${a}-${b}`);
                routeEdgeKeys.add(`${b}-${a}`);
            }
        }

        // Determine node statuses
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
                    stroke: isActive ? "var(--accent-blue)" : "var(--border-color)",
                    strokeWidth: isActive ? 2.5 : 1,
                },
                labelStyle: {
                    fill: isActive ? "var(--accent-blue)" : "var(--text-muted)",
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                },
                animated: isActive,
            };
        });

        return { flowNodes, flowEdges };
    }, [graphData, shipment]);

    const cardStyle: React.CSSProperties = {
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
    };

    return (
        <div style={cardStyle}>
            <h2
                style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                }}
            >
                🗺️ Route Network
                {shipment && (
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--accent-cyan)" }}>
                        {shipment.shipment_id}
                    </span>
                )}
            </h2>
            <div style={{ height: "420px", borderRadius: "8px", overflow: "hidden", background: "var(--bg-primary)" }}>
                {flowNodes.length > 0 ? (
                    <ReactFlow
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        proOptions={{ hideAttribution: true }}
                        style={{ background: "var(--bg-primary)" }}
                    >
                        <Background color="var(--border-color)" gap={24} size={1} />
                        <Controls
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                        />
                        <MiniMap
                            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                            nodeColor="var(--accent-blue)"
                            maskColor="rgba(0,0,0,0.5)"
                        />
                    </ReactFlow>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                        Loading network graph...
                    </div>
                )}
            </div>
        </div>
    );
}

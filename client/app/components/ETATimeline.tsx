"use client";
import React from "react";
import type { Shipment } from "../page";

interface Props {
    shipment: Shipment | null;
}

export default function ETATimeline({ shipment }: Props) {
    const cardStyle: React.CSSProperties = {
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
    };

    if (!shipment) {
        return (
            <div style={cardStyle}>
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        margin: "0 0 16px 0",
                    }}
                >
                    🗺️ ETA Timeline
                </h2>
                <p
                    style={{
                        color: "var(--text-muted)",
                        textAlign: "center",
                        padding: "24px",
                        fontSize: "14px",
                    }}
                >
                    Select a shipment to view timeline
                </p>
            </div>
        );
    }

    const route = shipment.route || [];

    const formatDate = (iso: string | null) => {
        if (!iso) return "—";
        try {
            const d = new Date(iso);
            return d.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return iso;
        }
    };

    return (
        <div style={cardStyle}>
            <h2
                style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                }}
            >
                🗺️ ETA Timeline
                <span
                    style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--text-muted)",
                    }}
                >
                    {shipment.shipment_id}
                </span>
            </h2>

            <div style={{ position: "relative", paddingLeft: "24px" }}>
                {/* Vertical Line */}
                <div
                    style={{
                        position: "absolute",
                        left: "7px",
                        top: "4px",
                        bottom: "4px",
                        width: "2px",
                        background:
                            "linear-gradient(to bottom, var(--accent-blue), var(--accent-cyan), var(--accent-green))",
                        borderRadius: "1px",
                    }}
                />

                {route.map((node, i) => {
                    const isCompleted = !!node.actual_arrival;
                    const isCurrent =
                        !isCompleted &&
                        (i === 0 || !!route[i - 1]?.actual_arrival);
                    const isDelayed =
                        node.expected_arrival &&
                        node.eta &&
                        new Date(node.eta) > new Date(node.expected_arrival);

                    return (
                        <div
                            key={node.location_code}
                            className="animate-fade-in"
                            style={{
                                position: "relative",
                                paddingBottom: i === route.length - 1 ? 0 : "20px",
                                animationDelay: `${i * 0.1}s`,
                            }}
                        >
                            {/* Dot */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: "-24px",
                                    top: "2px",
                                    width: "16px",
                                    height: "16px",
                                    borderRadius: "50%",
                                    background: isCompleted
                                        ? "var(--accent-green)"
                                        : isCurrent
                                            ? "var(--accent-blue)"
                                            : "var(--bg-elevated)",
                                    border: isCompleted
                                        ? "none"
                                        : isCurrent
                                            ? "3px solid rgba(59,130,246,0.3)"
                                            : "2px solid var(--border-color)",
                                    boxShadow: isCurrent
                                        ? "0 0 12px rgba(59,130,246,0.4)"
                                        : "none",
                                }}
                            />

                            {/* Content */}
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        marginBottom: "4px",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            fontSize: "14px",
                                            color: isCompleted
                                                ? "var(--accent-green)"
                                                : isCurrent
                                                    ? "var(--text-primary)"
                                                    : "var(--text-secondary)",
                                        }}
                                    >
                                        {node.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            color: "var(--text-muted)",
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                            background: "var(--bg-secondary)",
                                        }}
                                    >
                                        {node.location_code}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--text-muted)",
                                        display: "flex",
                                        gap: "16px",
                                    }}
                                >
                                    {isCompleted && (
                                        <span>
                                            ✅ Arrived: {formatDate(node.actual_arrival)}
                                        </span>
                                    )}
                                    {node.eta && !isCompleted && (
                                        <span
                                            style={{
                                                color: isDelayed
                                                    ? "var(--accent-amber)"
                                                    : "var(--text-secondary)",
                                            }}
                                        >
                                            {isDelayed ? "⚠️" : "🕐"} ETA: {formatDate(node.eta)}
                                        </span>
                                    )}
                                    {node.expected_arrival && (
                                        <span>📅 Expected: {formatDate(node.expected_arrival)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

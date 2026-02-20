"use client";
import React from "react";
import type { Anomaly } from "../page";

interface Props {
    anomalies: Anomaly[];
}

const severityConfig: Record<string, { color: string; bg: string; icon: string }> = {
    CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "🔴" },
    HIGH: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "🟠" },
    MEDIUM: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: "🔵" },
    LOW: { color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: "🟢" },
};

const anomalyLabels: Record<string, string> = {
    TEMPERATURE_BREACH: "🌡️ Temperature Breach",
    WEIGHT_DEVIATION: "⚖️ Weight Deviation",
    DELAY: "⏱️ Delay",
    HUMIDITY_BREACH: "💧 Humidity Breach",
};

export default function AlertsPanel({ anomalies }: Props) {
    const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

    const cardStyle: React.CSSProperties = {
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
        maxHeight: "500px",
        overflowY: "auto",
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
                🚨 Risk Alerts
                {unresolvedAnomalies.length > 0 && (
                    <span
                        style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: "rgba(239,68,68,0.15)",
                            color: "var(--accent-red)",
                        }}
                    >
                        {unresolvedAnomalies.length} active
                    </span>
                )}
            </h2>

            {unresolvedAnomalies.length === 0 && (
                <div
                    style={{
                        textAlign: "center",
                        padding: "32px",
                        color: "var(--text-muted)",
                    }}
                >
                    <p style={{ fontSize: "28px", margin: "0 0 8px 0" }}>✅</p>
                    <p style={{ fontSize: "14px", margin: 0 }}>All clear — no active alerts</p>
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {unresolvedAnomalies.map((a, i) => {
                    const sev = severityConfig[a.severity] || severityConfig.MEDIUM;
                    return (
                        <div
                            key={`${a.shipment_id}-${a.anomaly_type}-${i}`}
                            className="animate-fade-in"
                            style={{
                                background: sev.bg,
                                borderRadius: "var(--radius-sm)",
                                padding: "14px",
                                border: `1px solid ${sev.color}22`,
                                animationDelay: `${i * 0.05}s`,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: "6px",
                                }}
                            >
                                <div>
                                    <span
                                        style={{
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: sev.color,
                                        }}
                                    >
                                        {anomalyLabels[a.anomaly_type] || a.anomaly_type}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--text-muted)",
                                            marginLeft: "8px",
                                        }}
                                    >
                                        {a.shipment_id}
                                    </span>
                                </div>
                                <span
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: "8px",
                                        background: `${sev.color}22`,
                                        color: sev.color,
                                    }}
                                >
                                    {a.severity}
                                </span>
                            </div>

                            {a.location_code && (
                                <p
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--text-secondary)",
                                        margin: "4px 0",
                                    }}
                                >
                                    📍 {a.location_code}
                                </p>
                            )}

                            {/* GenAI Assessment */}
                            {a.genai_assessment && (
                                <div
                                    style={{
                                        marginTop: "8px",
                                        padding: "10px",
                                        borderRadius: "6px",
                                        background: "var(--bg-secondary)",
                                        fontSize: "12px",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: "var(--accent-purple)",
                                            display: "block",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        🤖 AI Assessment
                                    </span>
                                    <p style={{ color: "var(--text-secondary)", margin: "2px 0" }}>
                                        {a.genai_assessment.risk_assessment}
                                    </p>
                                    <p
                                        style={{
                                            color: "var(--accent-amber)",
                                            margin: "4px 0 0 0",
                                            fontWeight: 500,
                                        }}
                                    >
                                        → {a.genai_assessment.recommended_action}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

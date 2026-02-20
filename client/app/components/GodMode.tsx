"use client";
import React, { useState } from "react";
import type { Shipment } from "../page";

interface Props {
    shipments: Shipment[];
    onAction: () => void;
    apiBase: string;
}

export default function GodMode({ shipments, onAction, apiBase }: Props) {
    const [activeTab, setActiveTab] = useState<"delay" | "temperature" | "weight">("delay");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const [delayForm, setDelayForm] = useState({ shipment_id: "", node_index: 0, delay_hours: 5 });
    const [tempForm, setTempForm] = useState({ shipment_id: "", location_code: "", observed_temperature: 25 });
    const [weightForm, setWeightForm] = useState({ shipment_id: "", location_code: "", observed_weight_kg: 900 });

    const executeAction = async (endpoint: string, body: any) => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`${apiBase}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            setResult(data);
            onAction();
        } catch (e: any) {
            setResult({ error: e.message });
        }
        setLoading(false);
    };

    const tabs = [
        { key: "delay" as const, label: "⏱️ Inject Delay", color: "var(--accent-amber)" },
        { key: "temperature" as const, label: "🌡️ Inject Temp Breach", color: "var(--accent-red)" },
        { key: "weight" as const, label: "⚖️ Inject Weight Loss", color: "var(--accent-purple)" },
    ];

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        color: "var(--text-primary)",
        fontSize: "14px",
        outline: "none",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--text-secondary)",
        marginBottom: "4px",
        display: "block",
    };

    return (
        <div
            style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.05), rgba(236,72,153,0.05))",
                borderBottom: "1px solid rgba(139,92,246,0.2)",
                padding: "16px 32px",
            }}
        >
            <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-purple)" }}>
                        ⚡ God Mode
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Inject anomalies to test the system
                    </span>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => { setActiveTab(t.key); setResult(null); }}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: activeTab === t.key ? `1px solid ${t.color}` : "1px solid var(--border-color)",
                                background: activeTab === t.key ? `${t.color}15` : "var(--bg-card)",
                                color: activeTab === t.key ? t.color : "var(--text-secondary)",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 500,
                                transition: "all 0.15s",
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Forms */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                        {activeTab === "delay" && (
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Shipment ID</label>
                                    <select
                                        style={inputStyle}
                                        value={delayForm.shipment_id}
                                        onChange={(e) => setDelayForm({ ...delayForm, shipment_id: e.target.value })}
                                    >
                                        <option value="">Select shipment...</option>
                                        {shipments.map((s) => (
                                            <option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ width: "120px" }}>
                                    <label style={labelStyle}>Node Index</label>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={delayForm.node_index}
                                        onChange={(e) => setDelayForm({ ...delayForm, node_index: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div style={{ width: "140px" }}>
                                    <label style={labelStyle}>Delay Hours</label>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={delayForm.delay_hours}
                                        onChange={(e) => setDelayForm({ ...delayForm, delay_hours: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <button
                                    onClick={() => executeAction("/god-mode/delay", delayForm)}
                                    disabled={loading || !delayForm.shipment_id}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: "var(--radius-sm)",
                                        border: "none",
                                        background: loading ? "var(--text-muted)" : "var(--gradient-danger)",
                                        color: "white",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {loading ? "..." : "💥 Inject"}
                                </button>
                            </div>
                        )}

                        {activeTab === "temperature" && (
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Shipment ID</label>
                                    <select
                                        style={inputStyle}
                                        value={tempForm.shipment_id}
                                        onChange={(e) => setTempForm({ ...tempForm, shipment_id: e.target.value })}
                                    >
                                        <option value="">Select shipment...</option>
                                        {shipments.map((s) => (
                                            <option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Location Code</label>
                                    <input
                                        style={inputStyle}
                                        placeholder="e.g. TRANSIT_1"
                                        value={tempForm.location_code}
                                        onChange={(e) => setTempForm({ ...tempForm, location_code: e.target.value })}
                                    />
                                </div>
                                <div style={{ width: "160px" }}>
                                    <label style={labelStyle}>Temperature (°C)</label>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={tempForm.observed_temperature}
                                        onChange={(e) => setTempForm({ ...tempForm, observed_temperature: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <button
                                    onClick={() => executeAction("/god-mode/temperature", tempForm)}
                                    disabled={loading || !tempForm.shipment_id || !tempForm.location_code}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: "var(--radius-sm)",
                                        border: "none",
                                        background: loading ? "var(--text-muted)" : "var(--gradient-danger)",
                                        color: "white",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {loading ? "..." : "💥 Inject"}
                                </button>
                            </div>
                        )}

                        {activeTab === "weight" && (
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Shipment ID</label>
                                    <select
                                        style={inputStyle}
                                        value={weightForm.shipment_id}
                                        onChange={(e) => setWeightForm({ ...weightForm, shipment_id: e.target.value })}
                                    >
                                        <option value="">Select shipment...</option>
                                        {shipments.map((s) => (
                                            <option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Location Code</label>
                                    <input
                                        style={inputStyle}
                                        placeholder="e.g. TRANSIT_1"
                                        value={weightForm.location_code}
                                        onChange={(e) => setWeightForm({ ...weightForm, location_code: e.target.value })}
                                    />
                                </div>
                                <div style={{ width: "160px" }}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={weightForm.observed_weight_kg}
                                        onChange={(e) => setWeightForm({ ...weightForm, observed_weight_kg: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <button
                                    onClick={() => executeAction("/god-mode/weight", weightForm)}
                                    disabled={loading || !weightForm.shipment_id || !weightForm.location_code}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: "var(--radius-sm)",
                                        border: "none",
                                        background: loading ? "var(--text-muted)" : "var(--gradient-danger)",
                                        color: "white",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {loading ? "..." : "💥 Inject"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Result */}
                {result && (
                    <div
                        className="animate-fade-in"
                        style={{
                            marginTop: "12px",
                            padding: "12px",
                            borderRadius: "var(--radius-sm)",
                            background: result.error ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                            border: `1px solid ${result.error ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                            fontSize: "12px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-secondary)",
                            maxHeight: "200px",
                            overflow: "auto",
                        }}
                    >
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

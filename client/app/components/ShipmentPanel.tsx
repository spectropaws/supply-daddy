"use client";
import React, { useState } from "react";
import type { Shipment, Role } from "../page";

interface Props {
    shipments: Shipment[];
    selectedShipment: Shipment | null;
    onSelect: (s: Shipment) => void;
    onCreated: () => void;
    apiBase: string;
    role: Role;
}

const statusColors: Record<string, string> = {
    created: "var(--accent-blue)",
    in_transit: "var(--accent-amber)",
    delivered: "var(--accent-green)",
    anomaly: "var(--accent-red)",
};

export default function ShipmentPanel({
    shipments,
    selectedShipment,
    onSelect,
    onCreated,
    apiBase,
    role,
}: Props) {
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        shipment_id: "",
        origin: "",
        destination: "",
        po_text: "",
        invoice_text: "",
        bol_text: "",
    });

    const handleCreate = async () => {
        if (!form.shipment_id || !form.origin || !form.destination) return;
        setCreating(true);
        try {
            const body = {
                shipment_id: form.shipment_id,
                origin: form.origin,
                destination: form.destination,
                route: [
                    {
                        location_code: form.origin,
                        name: `${form.origin} Hub`,
                        expected_arrival: new Date().toISOString(),
                    },
                    {
                        location_code: "TRANSIT_1",
                        name: "Transit Hub 1",
                        expected_arrival: new Date(
                            Date.now() + 24 * 60 * 60 * 1000
                        ).toISOString(),
                    },
                    {
                        location_code: form.destination,
                        name: `${form.destination} Hub`,
                        expected_arrival: new Date(
                            Date.now() + 48 * 60 * 60 * 1000
                        ).toISOString(),
                    },
                ],
                ...(form.po_text && { po_text: form.po_text }),
                ...(form.invoice_text && { invoice_text: form.invoice_text }),
                ...(form.bol_text && { bol_text: form.bol_text }),
            };
            const res = await fetch(`${apiBase}/shipments/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setShowCreate(false);
                setForm({
                    shipment_id: "",
                    origin: "",
                    destination: "",
                    po_text: "",
                    invoice_text: "",
                    bol_text: "",
                });
                onCreated();
            }
        } catch (e) {
            console.error("Create shipment error:", e);
        }
        setCreating(false);
    };

    const cardStyle: React.CSSProperties = {
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
        fontSize: "14px",
        outline: "none",
        transition: "border-color 0.2s",
    };

    return (
        <div style={cardStyle}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                }}
            >
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    📋 Active Shipments
                    <span
                        style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                        }}
                    >
                        {shipments.length}
                    </span>
                </h2>
                {role === "manufacturer" && (
                    <button
                        id="create-shipment-btn"
                        onClick={() => setShowCreate(!showCreate)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            background: "var(--gradient-primary)",
                            color: "white",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "transform 0.15s, box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.transform = "scale(1.03)";
                            (e.target as HTMLButtonElement).style.boxShadow =
                                "var(--shadow-glow)";
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.transform = "scale(1)";
                            (e.target as HTMLButtonElement).style.boxShadow = "none";
                        }}
                    >
                        + New Shipment
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showCreate && (
                <div
                    className="animate-fade-in"
                    style={{
                        background: "var(--bg-secondary)",
                        borderRadius: "var(--radius-sm)",
                        padding: "16px",
                        marginBottom: "16px",
                        border: "1px solid var(--border-color)",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "12px",
                            marginBottom: "12px",
                        }}
                    >
                        <input
                            id="input-shipment-id"
                            style={inputStyle}
                            placeholder="Shipment ID"
                            value={form.shipment_id}
                            onChange={(e) =>
                                setForm({ ...form, shipment_id: e.target.value })
                            }
                        />
                        <input
                            id="input-origin"
                            style={inputStyle}
                            placeholder="Origin"
                            value={form.origin}
                            onChange={(e) => setForm({ ...form, origin: e.target.value })}
                        />
                        <input
                            id="input-destination"
                            style={inputStyle}
                            placeholder="Destination"
                            value={form.destination}
                            onChange={(e) =>
                                setForm({ ...form, destination: e.target.value })
                            }
                        />
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "12px",
                            marginBottom: "12px",
                        }}
                    >
                        <textarea
                            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                            placeholder="PO text (optional)"
                            value={form.po_text}
                            onChange={(e) => setForm({ ...form, po_text: e.target.value })}
                        />
                        <textarea
                            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                            placeholder="Invoice text (optional)"
                            value={form.invoice_text}
                            onChange={(e) =>
                                setForm({ ...form, invoice_text: e.target.value })
                            }
                        />
                        <textarea
                            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                            placeholder="BOL text (optional)"
                            value={form.bol_text}
                            onChange={(e) => setForm({ ...form, bol_text: e.target.value })}
                        />
                    </div>
                    <button
                        id="submit-shipment-btn"
                        onClick={handleCreate}
                        disabled={creating}
                        style={{
                            padding: "10px 24px",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            background: creating ? "var(--text-muted)" : "var(--gradient-success)",
                            color: "white",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: creating ? "not-allowed" : "pointer",
                        }}
                    >
                        {creating ? "Creating..." : "🚀 Create Shipment"}
                    </button>
                </div>
            )}

            {/* Shipment List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {shipments.length === 0 && (
                    <p
                        style={{
                            color: "var(--text-muted)",
                            textAlign: "center",
                            padding: "32px",
                            fontSize: "14px",
                        }}
                    >
                        No shipments yet. Create one to get started!
                    </p>
                )}
                {shipments.map((s) => (
                    <button
                        key={s.shipment_id}
                        onClick={() => onSelect(s)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            borderRadius: "var(--radius-sm)",
                            border:
                                selectedShipment?.shipment_id === s.shipment_id
                                    ? "1px solid var(--accent-blue)"
                                    : "1px solid transparent",
                            background:
                                selectedShipment?.shipment_id === s.shipment_id
                                    ? "var(--bg-elevated)"
                                    : "transparent",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            textAlign: "left",
                            width: "100%",
                            color: "var(--text-primary)",
                        }}
                    >
                        <div>
                            <span
                                style={{ fontWeight: 600, fontSize: "14px" }}
                            >
                                {s.shipment_id}
                            </span>
                            <span
                                style={{
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                    marginLeft: "12px",
                                }}
                            >
                                {s.origin} → {s.destination}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {s.risk_profile?.product_category && (
                                <span
                                    style={{
                                        fontSize: "11px",
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        background: "var(--bg-secondary)",
                                        color: "var(--accent-cyan)",
                                        fontWeight: 500,
                                    }}
                                >
                                    {s.risk_profile.product_category}
                                </span>
                            )}
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background:
                                        statusColors[s.current_status] || "var(--text-muted)",
                                }}
                            />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

"use client";
import React, { useState, useEffect } from "react";
import type { Shipment, Role } from "../page";
import { apiFetch, API_BASE } from "../lib/apiFetch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface GraphNode { code: string; name: string; }
interface ReceiverUser { user_id: string; username: string; email: string; }

interface Props {
    shipments: Shipment[];
    selectedShipment: Shipment | null;
    onSelect: (s: Shipment) => void;
    onCreated: () => void;
    apiBase: string;
    role: Role;
    token: string | null;
}

const statusColors: Record<string, string> = {
    created: "bg-blue-500",
    in_transit: "bg-amber-500",
    delivered: "bg-green-500",
    anomaly: "bg-red-500",
};

export default function ShipmentPanel({ shipments, selectedShipment, onSelect, onCreated, apiBase, role, token }: Props) {
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [availableNodes, setAvailableNodes] = useState<GraphNode[]>([]);
    const [receivers, setReceivers] = useState<ReceiverUser[]>([]);
    const [form, setForm] = useState({ shipment_id: "", origin: "", destination: "", receiver_id: "", po_text: "", invoice_text: "", bol_text: "" });

    useEffect(() => {
        apiFetch(`${API_BASE}/routes/nodes`).then((r) => r.json()).then(setAvailableNodes).catch(() => { });
        apiFetch(`${API_BASE}/auth/users/receivers`).then((r) => r.json()).then(setReceivers).catch(() => { });
    }, []);

    const handleCreate = async () => {
        if (!form.shipment_id || !form.origin || !form.destination || !form.receiver_id) return;
        setCreating(true);
        try {
            const body = {
                shipment_id: form.shipment_id, origin: form.origin, destination: form.destination, receiver_id: form.receiver_id, route: [],
                ...(form.po_text && { po_text: form.po_text }), ...(form.invoice_text && { invoice_text: form.invoice_text }), ...(form.bol_text && { bol_text: form.bol_text })
            };
            const res = await apiFetch(`${apiBase}/shipments/`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
            if (res.ok) { setShowCreate(false); setForm({ shipment_id: "", origin: "", destination: "", receiver_id: "", po_text: "", invoice_text: "", bol_text: "" }); onCreated(); }
            else { const err = await res.json(); alert(err.detail || "Failed to create shipment"); }
        } catch (e) { console.error("Create shipment error:", e); }
        setCreating(false);
    };

    const selectClass = "flex h-9 w-full rounded-md bg-secondary/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer border-0";

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    📋 {role === "receiver" ? "Assigned Shipments" : role === "transit_node" ? "At My Nodes" : "Active Shipments"}
                    <span className="text-xs text-muted-foreground font-normal bg-secondary/60 px-2 py-0.5 rounded-full">{shipments.length}</span>
                </CardTitle>
                {role === "manufacturer" && (
                    <Button id="create-shipment-btn" size="sm" onClick={() => setShowCreate(!showCreate)}
                        className="text-xs bg-foreground text-background hover:bg-foreground/90">
                        + New Shipment
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-2">
                {showCreate && (
                    <div className="animate-fade-in-scale bg-secondary/30 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Shipment ID</Label>
                                <Input id="input-shipment-id" placeholder="e.g. SHIP-001" value={form.shipment_id}
                                    onChange={(e) => setForm({ ...form, shipment_id: e.target.value })} className="bg-secondary/50 border-0" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Receiver</Label>
                                <select className={selectClass} value={form.receiver_id} onChange={(e) => setForm({ ...form, receiver_id: e.target.value })}>
                                    <option value="">Select receiver...</option>
                                    {receivers.map((r) => <option key={r.user_id} value={r.user_id}>{r.username} ({r.email})</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Origin Node</Label>
                                <select id="input-origin" className={selectClass} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                                    <option value="">Select origin...</option>
                                    {availableNodes.map((n) => <option key={n.code} value={n.code}>{n.code} — {n.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Destination Node</Label>
                                <select id="input-destination" className={selectClass} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                                    <option value="">Select destination...</option>
                                    {availableNodes.filter((n) => n.code !== form.origin).map((n) => <option key={n.code} value={n.code}>{n.code} — {n.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <textarea className="flex w-full rounded-md bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y border-0"
                                placeholder="PO text (optional)" value={form.po_text} onChange={(e) => setForm({ ...form, po_text: e.target.value })} />
                            <textarea className="flex w-full rounded-md bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y border-0"
                                placeholder="Invoice (optional)" value={form.invoice_text} onChange={(e) => setForm({ ...form, invoice_text: e.target.value })} />
                            <textarea className="flex w-full rounded-md bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y border-0"
                                placeholder="BOL (optional)" value={form.bol_text} onChange={(e) => setForm({ ...form, bol_text: e.target.value })} />
                        </div>
                        {form.origin && form.destination && (
                            <div className="p-2 rounded-md bg-cyan-500/5 text-xs text-cyan-400">
                                🔀 Route auto-generated: <strong>{form.origin}</strong> → <strong>{form.destination}</strong>
                            </div>
                        )}
                        <Button id="submit-shipment-btn" onClick={handleCreate}
                            disabled={creating || !form.shipment_id || !form.origin || !form.destination || !form.receiver_id}
                            className="bg-foreground text-background hover:bg-foreground/90 text-xs">
                            {creating ? "Creating..." : "🚀 Create Shipment"}
                        </Button>
                    </div>
                )}

                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                    {shipments.length === 0 && (
                        <p className="text-muted-foreground text-center py-8 text-sm">
                            {role === "manufacturer" ? "No shipments yet. Create one!" : role === "receiver" ? "No shipments assigned yet." : "No shipments at your nodes."}
                        </p>
                    )}
                    {shipments.map((s, i) => (
                        <button
                            key={s.shipment_id}
                            onClick={() => onSelect(s)}
                            className={`animate-fade-in flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left w-full transition-all duration-200 cursor-pointer group ${selectedShipment?.shipment_id === s.shipment_id
                                    ? "bg-secondary shadow-sm"
                                    : "hover:bg-secondary/50"
                                }`}
                            style={{ animationDelay: `${i * 30}ms` }}
                        >
                            <div>
                                <span className="font-semibold text-sm group-hover:text-foreground transition-colors">{s.shipment_id}</span>
                                <span className="text-xs text-muted-foreground ml-2">{s.origin} → {s.destination}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {s.risk_profile?.product_category && (
                                    <span className="text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">{s.risk_profile.product_category}</span>
                                )}
                                <span className={`w-2 h-2 rounded-full ${statusColors[s.current_status] || "bg-muted-foreground"} transition-all`} />
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

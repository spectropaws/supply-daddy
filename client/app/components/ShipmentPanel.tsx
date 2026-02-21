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
    const [form, setForm] = useState({
        origin: "", destination: "", receiver_id: "",
    });
    const [files, setFiles] = useState<{
        po_file: File | null;
        invoice_file: File | null;
        bol_file: File | null;
    }>({ po_file: null, invoice_file: null, bol_file: null });

    useEffect(() => {
        apiFetch(`${API_BASE}/routes/nodes`).then((r) => r.json()).then(setAvailableNodes).catch(() => { });
        apiFetch(`${API_BASE}/auth/users/receivers`).then((r) => r.json()).then(setReceivers).catch(() => { });
    }, []);

    const handleCreate = async () => {
        if (!form.origin || !form.destination || !form.receiver_id) return;
        setCreating(true);
        try {
            // Send files as FormData — backend does PDF text extraction
            const formData = new FormData();
            formData.append("origin", form.origin);
            formData.append("destination", form.destination);
            formData.append("receiver_id", form.receiver_id);
            if (files.po_file) formData.append("po_file", files.po_file);
            if (files.invoice_file) formData.append("invoice_file", files.invoice_file);
            if (files.bol_file) formData.append("bol_file", files.bol_file);

            const res = await apiFetch(`${apiBase}/shipments/`, {
                method: "POST",
                headers: {
                    // No Content-Type — browser sets it automatically with boundary for FormData
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: formData,
            });

            if (res.ok) {
                setShowCreate(false);
                setForm({ origin: "", destination: "", receiver_id: "" });
                setFiles({ po_file: null, invoice_file: null, bol_file: null });
                onCreated();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to create shipment");
            }
        } catch (e) { console.error("Create shipment error:", e); }
        setCreating(false);
    };

    const selectClass = "flex h-9 w-full rounded-md bg-secondary/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer border-0";
    const fileInputClass = "flex h-9 w-full rounded-md bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground file:border-0 file:bg-transparent file:text-foreground file:text-[11px] file:font-medium appearance-none cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    const FileUploadBox = ({ id, label, icon, file, onChange }: { id: string, label: string, icon: string, file: File | null, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
        <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:bg-secondary/40 transition-colors cursor-pointer group h-24">
            <input type="file" id={id} accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onChange} />
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">{icon}</div>
            <div className="text-[11px] font-medium text-foreground">{label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-full truncate px-2">
                {file ? <span className="text-blue-600 dark:text-blue-400 font-semibold">{file.name}</span> : "Click to select"}
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    📋 {role === "receiver" ? "Assigned Shipments" : "Active Shipments"}
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
                        {/* Row 1: Receiver */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Receiver</Label>
                                <select className={selectClass} value={form.receiver_id} onChange={(e) => setForm({ ...form, receiver_id: e.target.value })}>
                                    <option value="">Select receiver...</option>
                                    {receivers.map((r) => <option key={r.user_id} value={r.user_id}>{r.username} ({r.email})</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Origin + Destination */}
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

                        {/* Row 3: Documents (PDFs) */}
                        <div className="space-y-1 pt-1">
                            <Label className="text-[11px] text-muted-foreground">
                                Upload Documents <span className="text-muted-foreground/60">(PDFs — binary hashed & securely anchored on-chain)</span>
                            </Label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                <FileUploadBox id="po_file" label="Purchase Order" icon="🧾" file={files.po_file}
                                    onChange={(e) => setFiles({ ...files, po_file: e.target.files?.[0] || null })} />
                                <FileUploadBox id="invoice_file" label="Invoice" icon="💸" file={files.invoice_file}
                                    onChange={(e) => setFiles({ ...files, invoice_file: e.target.files?.[0] || null })} />
                                <FileUploadBox id="bol_file" label="Bill of Lading" icon="📦" file={files.bol_file}
                                    onChange={(e) => setFiles({ ...files, bol_file: e.target.files?.[0] || null })} />
                            </div>
                        </div>

                        <Button
                            id="submit-shipment-btn"
                            disabled={creating || !form.origin || !form.destination || !form.receiver_id}
                            onClick={handleCreate}
                            className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white mt-2"
                        >
                            {creating ? "⏳ Submitting & Hashing..." : "🚀 Finalize & Anchor on Blockchain"}
                        </Button>
                    </div>
                )}

                {/* Shipment List */}
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
            </CardContent >
        </Card >
    );
}

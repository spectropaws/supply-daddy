"use client";
import React, { useState } from "react";
import type { Shipment } from "../page";
import { apiFetch } from "../lib/apiFetch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

interface Props { shipments: Shipment[]; onAction: () => void; apiBase: string; token: string | null; }

export default function GodMode({ shipments, onAction, apiBase, token }: Props) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Unified scan form
    const [scanForm, setScanForm] = useState({
        shipment_id: "", location_code: "",
        temperature: 22, humidity: 45, weight_kg: 100,
    });

    // Tamper form — now text-based instead of file-based
    const [tamperForm, setTamperForm] = useState({ shipment_id: "" });
    const [tamperTexts, setTamperTexts] = useState({
        po_text: "", invoice_text: "", bol_text: "",
    });

    const exec = async (endpoint: string, body: any, method: string = "POST") => {
        setLoading(true); setResult(null);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await apiFetch(`${apiBase}${endpoint}`, { method, headers, body: JSON.stringify(body) });

            setResult(await res.json());
            onAction();
        } catch (e: any) { setResult({ error: e.message }); }
        setLoading(false);
    };

    const sc = "flex h-9 w-full rounded-md bg-secondary/50 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer border-0";
    const ic = "bg-secondary/50 border-0";
    const tac = "flex w-full rounded-md bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[50px] resize-y border-0";

    // Get next unvisited node for a shipment
    const getNextNode = (shipmentId: string): string => {
        const s = shipments.find((s) => s.shipment_id === shipmentId);
        if (!s) return "";
        return s.route.find((n) => !n.actual_arrival)?.location_code || "";
    };

    return (
        <div className="bg-gradient-to-r from-purple-500/3 to-pink-500/3 border-b border-border/30 px-8 py-4">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">⚡ God Mode</span>
                    <span className="text-[11px] text-muted-foreground">Manually scan nodes or tamper documents</span>
                </div>
                <Tabs defaultValue="scan" onValueChange={() => setResult(null)}>
                    <TabsList className="bg-secondary/40">
                        <TabsTrigger value="scan" className="text-xs">📡 Scan & Transfer</TabsTrigger>
                        <TabsTrigger value="tamper" className="text-xs">🔓 Tamper Docs</TabsTrigger>
                    </TabsList>

                    {/* ─── Scan & Transfer ─── */}
                    <TabsContent value="scan">
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex gap-3 items-end flex-wrap">
                                {/* Shipment select */}
                                <div className="flex-1 min-w-[180px] space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Shipment</Label>
                                    <select className={sc} value={scanForm.shipment_id} onChange={(e) => {
                                        const sid = e.target.value;
                                        setScanForm({ ...scanForm, shipment_id: sid, location_code: getNextNode(sid) });
                                    }}>
                                        <option value="">Select...</option>
                                        {shipments.filter(s => s.current_status !== "delivered").map((s) => {
                                            const next = s.route.find(n => !n.actual_arrival);
                                            return <option key={s.shipment_id} value={s.shipment_id}>
                                                {s.shipment_id} → next: {next?.location_code || "done"}
                                            </option>;
                                        })}
                                    </select>
                                </div>

                                {/* Next node (auto-filled, read-only) */}
                                <div className="w-[90px] space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Node</Label>
                                    <Input className={ic} value={scanForm.location_code} readOnly />
                                </div>

                                {/* Telemetry inputs */}
                                <div className="w-[80px] space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Temp °C</Label>
                                    <Input className={ic} type="number" value={scanForm.temperature}
                                        onChange={(e) => setScanForm({ ...scanForm, temperature: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="w-[80px] space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Humidity %</Label>
                                    <Input className={ic} type="number" value={scanForm.humidity}
                                        onChange={(e) => setScanForm({ ...scanForm, humidity: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="w-[90px] space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Weight kg</Label>
                                    <Input className={ic} type="number" value={scanForm.weight_kg}
                                        onChange={(e) => setScanForm({ ...scanForm, weight_kg: parseFloat(e.target.value) || 0 })} />
                                </div>

                                <Button
                                    onClick={() => exec("/checkpoints/", scanForm)}
                                    disabled={loading || !scanForm.shipment_id || !scanForm.location_code}
                                    className="bg-foreground text-background hover:bg-foreground/90 text-xs"
                                >{loading ? "⏳ Scanning..." : "📡 Scan & Transfer"}</Button>
                            </div>

                            {/* Route progress visualization */}
                            {scanForm.shipment_id && (() => {
                                const s = shipments.find(sh => sh.shipment_id === scanForm.shipment_id);
                                if (!s) return null;
                                return (
                                    <div className="flex gap-1.5 items-center text-[11px]">
                                        {s.route.map((n, i) => (
                                            <React.Fragment key={n.location_code}>
                                                <span className={`px-1.5 py-0.5 rounded ${n.actual_arrival ? "bg-green-500/10 text-green-600 dark:text-green-400" : n.location_code === scanForm.location_code ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground"}`}>
                                                    {n.location_code}
                                                </span>
                                                {i < s.route.length - 1 && <span className="text-muted-foreground/40">→</span>}
                                            </React.Fragment>
                                        ))}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.current_status === "delivered" ? "bg-green-500/10 text-green-600 dark:text-green-400" : s.current_status === "in_transit" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                                            {s.current_status}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    </TabsContent>

                    {/* ─── Tamper Docs ─── */}
                    <TabsContent value="tamper">
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex gap-3 items-end">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Shipment</Label>
                                    <select className={sc} value={tamperForm.shipment_id} onChange={(e) => setTamperForm({ ...tamperForm, shipment_id: e.target.value })}>
                                        <option value="">Select...</option>
                                        {shipments.map((s) => <option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id} ({s.origin}→{s.destination})</option>)}
                                    </select>
                                </div>
                            </div>
                            {tamperForm.shipment_id && (
                                <>
                                    <div className="p-2 rounded-md bg-red-500/5 text-[11px] text-red-600 dark:text-red-400">
                                        ⚠️ Editing these fields overwrites the document text in Firestore <strong>without</strong> updating the on-chain hash. The next checkpoint will detect the hash mismatch and flag a <strong>document_tampered</strong> anomaly.
                                    </div>
                                    <div className="space-y-2 mt-1">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-red-600 dark:text-red-400">🧾 Tampered PO Text</Label>
                                            <textarea className={tac} placeholder="Enter fake purchase order text..."
                                                value={tamperTexts.po_text}
                                                onChange={(e) => setTamperTexts({ ...tamperTexts, po_text: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-red-600 dark:text-red-400">💸 Tampered Invoice Text</Label>
                                            <textarea className={tac} placeholder="Enter fake invoice text..."
                                                value={tamperTexts.invoice_text}
                                                onChange={(e) => setTamperTexts({ ...tamperTexts, invoice_text: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-red-600 dark:text-red-400">📦 Tampered BOL Text</Label>
                                            <textarea className={tac} placeholder="Enter fake bill of lading text..."
                                                value={tamperTexts.bol_text}
                                                onChange={(e) => setTamperTexts({ ...tamperTexts, bol_text: e.target.value })} />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => {
                                            const payload: any = {};
                                            if (tamperTexts.po_text) payload.po_text = tamperTexts.po_text;
                                            if (tamperTexts.invoice_text) payload.invoice_text = tamperTexts.invoice_text;
                                            if (tamperTexts.bol_text) payload.bol_text = tamperTexts.bol_text;
                                            exec(`/shipments/${tamperForm.shipment_id}/tamper`, payload, "PUT");
                                        }}
                                        disabled={loading || !tamperForm.shipment_id || (!tamperTexts.po_text && !tamperTexts.invoice_text && !tamperTexts.bol_text)}
                                        className="bg-red-600 text-white hover:bg-red-700 text-xs"
                                    >{loading ? "⏳..." : "🔓 Tamper Documents"}</Button>
                                </>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {result && (
                    <div className={`animate-fade-in-scale mt-3 p-3 rounded-lg text-xs font-mono max-h-[180px] overflow-auto ${result.error || result.hash_verification?.tamper_detected || result.status === "tampered" ? "bg-red-500/5 text-red-600 dark:text-red-400" : result.status === "delivered" ? "bg-green-500/5 text-green-600 dark:text-green-400" : "bg-secondary/30 text-muted-foreground"}`}>
                        <pre className="whitespace-pre-wrap m-0">{JSON.stringify(result, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

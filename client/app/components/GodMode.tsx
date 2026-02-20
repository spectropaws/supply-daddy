"use client";
import React, { useState } from "react";
import type { Shipment } from "../page";
import { apiFetch } from "../lib/apiFetch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

interface Props { shipments: Shipment[]; onAction: () => void; apiBase: string; }

export default function GodMode({ shipments, onAction, apiBase }: Props) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [delayForm, setDelayForm] = useState({ shipment_id: "", node_index: 0, delay_hours: 5 });
    const [tempForm, setTempForm] = useState({ shipment_id: "", location_code: "", observed_temperature: 25 });
    const [weightForm, setWeightForm] = useState({ shipment_id: "", location_code: "", observed_weight_kg: 900 });

    const exec = async (endpoint: string, body: any) => {
        setLoading(true); setResult(null);
        try { const res = await apiFetch(`${apiBase}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setResult(await res.json()); onAction(); }
        catch (e: any) { setResult({ error: e.message }); }
        setLoading(false);
    };

    const sc = "flex h-9 w-full rounded-md bg-secondary/50 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer border-0";
    const ic = "bg-secondary/50 border-0";

    const shipSelect = (val: string, set: (v: string) => void) => (
        <div className="flex-1 space-y-1"><Label className="text-[11px] text-muted-foreground">Shipment</Label>
            <select className={sc} value={val} onChange={(e) => set(e.target.value)}>
                <option value="">Select...</option>
                {shipments.map((s) => <option key={s.shipment_id} value={s.shipment_id}>{s.shipment_id}</option>)}
            </select></div>);

    return (
        <div className="bg-gradient-to-r from-purple-500/3 to-pink-500/3 border-b border-border/30 px-8 py-4">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-purple-400">⚡ God Mode</span>
                    <span className="text-[11px] text-muted-foreground">Inject anomalies to test the system</span>
                </div>
                <Tabs defaultValue="delay" onValueChange={() => setResult(null)}>
                    <TabsList className="bg-secondary/40">
                        <TabsTrigger value="delay" className="text-xs">⏱️ Delay</TabsTrigger>
                        <TabsTrigger value="temperature" className="text-xs">🌡️ Temp</TabsTrigger>
                        <TabsTrigger value="weight" className="text-xs">⚖️ Weight</TabsTrigger>
                    </TabsList>
                    <TabsContent value="delay"><div className="flex gap-3 items-end animate-fade-in">
                        {shipSelect(delayForm.shipment_id, (v) => setDelayForm({ ...delayForm, shipment_id: v }))}
                        <div className="w-[100px] space-y-1"><Label className="text-[11px] text-muted-foreground">Node Idx</Label><Input className={ic} type="number" value={delayForm.node_index} onChange={(e) => setDelayForm({ ...delayForm, node_index: parseInt(e.target.value) || 0 })} /></div>
                        <div className="w-[120px] space-y-1"><Label className="text-[11px] text-muted-foreground">Hours</Label><Input className={ic} type="number" value={delayForm.delay_hours} onChange={(e) => setDelayForm({ ...delayForm, delay_hours: parseFloat(e.target.value) || 0 })} /></div>
                        <Button onClick={() => exec("/god-mode/delay", delayForm)} disabled={loading || !delayForm.shipment_id} className="bg-foreground text-background hover:bg-foreground/90 text-xs">{loading ? "..." : "💥 Inject"}</Button>
                    </div></TabsContent>
                    <TabsContent value="temperature"><div className="flex gap-3 items-end animate-fade-in">
                        {shipSelect(tempForm.shipment_id, (v) => setTempForm({ ...tempForm, shipment_id: v }))}
                        <div className="flex-1 space-y-1"><Label className="text-[11px] text-muted-foreground">Location</Label><Input className={ic} placeholder="TRANSIT_1" value={tempForm.location_code} onChange={(e) => setTempForm({ ...tempForm, location_code: e.target.value })} /></div>
                        <div className="w-[130px] space-y-1"><Label className="text-[11px] text-muted-foreground">Temp °C</Label><Input className={ic} type="number" value={tempForm.observed_temperature} onChange={(e) => setTempForm({ ...tempForm, observed_temperature: parseFloat(e.target.value) || 0 })} /></div>
                        <Button onClick={() => exec("/god-mode/temperature", tempForm)} disabled={loading || !tempForm.shipment_id || !tempForm.location_code} className="bg-foreground text-background hover:bg-foreground/90 text-xs">{loading ? "..." : "💥 Inject"}</Button>
                    </div></TabsContent>
                    <TabsContent value="weight"><div className="flex gap-3 items-end animate-fade-in">
                        {shipSelect(weightForm.shipment_id, (v) => setWeightForm({ ...weightForm, shipment_id: v }))}
                        <div className="flex-1 space-y-1"><Label className="text-[11px] text-muted-foreground">Location</Label><Input className={ic} placeholder="TRANSIT_1" value={weightForm.location_code} onChange={(e) => setWeightForm({ ...weightForm, location_code: e.target.value })} /></div>
                        <div className="w-[130px] space-y-1"><Label className="text-[11px] text-muted-foreground">Weight kg</Label><Input className={ic} type="number" value={weightForm.observed_weight_kg} onChange={(e) => setWeightForm({ ...weightForm, observed_weight_kg: parseFloat(e.target.value) || 0 })} /></div>
                        <Button onClick={() => exec("/god-mode/weight", weightForm)} disabled={loading || !weightForm.shipment_id || !weightForm.location_code} className="bg-foreground text-background hover:bg-foreground/90 text-xs">{loading ? "..." : "💥 Inject"}</Button>
                    </div></TabsContent>
                </Tabs>
                {result && (<div className={`animate-fade-in-scale mt-3 p-3 rounded-lg text-xs font-mono max-h-[180px] overflow-auto ${result.error ? "bg-red-500/5 text-red-400" : "bg-green-500/5 text-muted-foreground"}`}><pre className="whitespace-pre-wrap m-0">{JSON.stringify(result, null, 2)}</pre></div>)}
            </div>
        </div>
    );
}

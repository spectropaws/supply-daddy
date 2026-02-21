"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Shipment } from "../page";
import { apiFetch, API_BASE } from "../lib/apiFetch";

interface Props {
    shipments: Shipment[];
    paused: boolean;
    token: string | null;
    onCheckpointComplete: () => void;
    /**
     * How many real seconds = 1 simulated travel hour.
     * Default 3 → a 4-hour edge takes 12 real seconds.
     */
    secondsPerHour?: number;
}

interface GraphEdge {
    source: string;
    target: string;
    travel_hours: number;
    label: string;
}

interface SimState {
    activeShipmentId: string | null;
    nextNode: string | null;
    countdown: number;
    totalSeconds: number; // total interval for this hop
    lastResult: any | null;
    totalScanned: number;
    scanning: boolean;
    travelHours: number; // display the real travel hours
}

export default function SimulationBar({
    shipments,
    paused,
    token,
    onCheckpointComplete,
    secondsPerHour = 3,
}: Props) {
    const [sim, setSim] = useState<SimState>({
        activeShipmentId: null,
        nextNode: null,
        countdown: 0,
        totalSeconds: 0,
        lastResult: null,
        totalScanned: 0,
        scanning: false,
        travelHours: 0,
    });

    // Graph edges for travel-time lookup
    const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);

    useEffect(() => {
        apiFetch(`${API_BASE}/routes/graph`)
            .then((r) => r.json())
            .then((data) => setGraphEdges(data.edges || []))
            .catch(console.error);
    }, []);

    // Stable refs
    const shipmentsRef = useRef(shipments);
    shipmentsRef.current = shipments;
    const tokenRef = useRef(token);
    tokenRef.current = token;
    const onCompleteRef = useRef(onCheckpointComplete);
    onCompleteRef.current = onCheckpointComplete;
    const pausedRef = useRef(paused);
    pausedRef.current = paused;
    const graphEdgesRef = useRef(graphEdges);
    graphEdgesRef.current = graphEdges;

    const scanningRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    /** Get travel_hours between two nodes from graph edges */
    const getTravelHours = useCallback((from: string, to: string): number => {
        const edges = graphEdgesRef.current;
        const edge = edges.find(
            (e) => (e.source === from && e.target === to) || (e.source === to && e.target === from)
        );
        return edge?.travel_hours ?? 4; // default 4h if not found
    }, []);

    /** Find the next unvisited node + the previous node (to compute travel time) */
    const findNextTarget = useCallback((): {
        shipmentId: string;
        nodeCode: string;
        prevNode: string;
        travelHours: number;
    } | null => {
        for (const s of shipmentsRef.current) {
            if (s.current_status === "delivered") continue;
            const idx = s.route.findIndex((n) => !n.actual_arrival);
            if (idx >= 0) {
                const prevCode = idx > 0 ? s.route[idx - 1].location_code : s.route[idx].location_code;
                const nextCode = s.route[idx].location_code;
                const hours = idx > 0 ? getTravelHours(prevCode, nextCode) : 1; // origin scan is quick
                return { shipmentId: s.shipment_id, nodeCode: nextCode, prevNode: prevCode, travelHours: hours };
            }
        }
        return null;
    }, [getTravelHours]);

    // Submit checkpoint
    const submitCheckpoint = useCallback(async (shipmentId: string, nodeCode: string) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        setSim((p) => ({ ...p, scanning: true }));

        try {
            const res = await apiFetch(`${API_BASE}/checkpoints/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
                },
                body: JSON.stringify({
                    shipment_id: shipmentId,
                    location_code: nodeCode,
                    temperature: 20 + Math.random() * 8,
                    humidity: 40 + Math.random() * 20,
                    weight_kg: 100,
                }),
            });
            const data = await res.json();
            setSim((p) => ({
                ...p,
                lastResult: data,
                totalScanned: p.totalScanned + 1,
                scanning: false,
            }));
            onCompleteRef.current();
        } catch (e) {
            console.error("Sim checkpoint error:", e);
            setSim((p) => ({ ...p, scanning: false }));
        } finally {
            scanningRef.current = false;
        }
    }, []);

    // Main simulation loop
    useEffect(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

        if (paused) {
            setSim((p) => ({ ...p, countdown: 0, totalSeconds: 0 }));
            return;
        }

        const runCycle = () => {
            if (pausedRef.current) return;

            const target = findNextTarget();
            if (!target) {
                setSim((p) => ({ ...p, activeShipmentId: null, nextNode: null, countdown: 0, totalSeconds: 0 }));
                return;
            }

            const intervalSec = Math.max(2, Math.round(target.travelHours * secondsPerHour));

            setSim((p) => ({
                ...p,
                activeShipmentId: target.shipmentId,
                nextNode: target.nodeCode,
                countdown: intervalSec,
                totalSeconds: intervalSec,
                travelHours: target.travelHours,
            }));

            // Countdown ticker
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                setSim((p) => ({ ...p, countdown: Math.max(0, p.countdown - 1) }));
            }, 1000);

            // Fire checkpoint after dynamic interval
            timerRef.current = setTimeout(async () => {
                if (pausedRef.current) return;
                if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

                await submitCheckpoint(target.shipmentId, target.nodeCode);

                timerRef.current = setTimeout(() => {
                    if (!pausedRef.current) runCycle();
                }, 2000);
            }, intervalSec * 1000);
        };

        // Wait for graph data before starting
        if (graphEdges.length === 0) return;

        timerRef.current = setTimeout(runCycle, 1000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [paused, secondsPerHour, findNextTarget, submitCheckpoint, graphEdges]);

    // ─── Render ────────────────────────────────────────────
    const activeShipment = shipments.find((s) => s.shipment_id === sim.activeShipmentId);
    const allDelivered = shipments.length > 0 && shipments.every((s) => s.current_status === "delivered");
    const hasActive = shipments.some((s) => s.current_status !== "delivered");

    if (shipments.length === 0) return null;

    return (
        <div className={`px-8 py-2.5 border-b transition-all duration-300 ${paused
            ? "bg-amber-500/5 border-amber-500/20"
            : allDelivered
                ? "bg-green-500/5 border-green-500/20"
                : "bg-blue-500/5 border-blue-500/20"
            }`}>
            <div className="max-w-[1800px] mx-auto flex items-center gap-4">
                {/* Status indicator */}
                <div className="flex items-center gap-2">
                    {paused ? (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            PAUSED
                        </span>
                    ) : allDelivered ? (
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            ALL DELIVERED
                        </span>
                    ) : sim.scanning ? (
                        <span className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            SCANNING
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            SIMULATING
                        </span>
                    )}
                </div>

                {/* Current target info */}
                {!paused && activeShipment && sim.nextNode && (
                    <div className="flex items-center gap-3 flex-1">
                        <span className="text-xs text-muted-foreground">
                            Next: <strong className="text-foreground">{sim.nextNode}</strong> on <strong className="text-foreground">{sim.activeShipmentId}</strong>
                            <span className="ml-1.5 text-muted-foreground/60">({sim.travelHours}h travel)</span>
                        </span>

                        {/* Countdown bar */}
                        <div className="flex-1 max-w-[200px] h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: sim.totalSeconds > 0 ? `${((sim.totalSeconds - sim.countdown) / sim.totalSeconds) * 100}%` : "0%" }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-[30px]">
                            {sim.countdown}s
                        </span>

                        {/* Route progress dots */}
                        <div className="flex gap-1 items-center">
                            {activeShipment.route.map((n) => (
                                <span
                                    key={n.location_code}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${n.actual_arrival
                                        ? "bg-green-500"
                                        : n.location_code === sim.nextNode
                                            ? "bg-blue-500 animate-pulse scale-125"
                                            : "bg-muted-foreground/30"
                                        }`}
                                    title={n.location_code}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {paused && hasActive && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex-1">
                        ⚡ God Mode active — simulation paused. Tamper documents, then close God Mode to resume.
                    </span>
                )}

                {allDelivered && !paused && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex-1">
                        All shipments have been delivered successfully.
                    </span>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{sim.totalScanned} scans</span>
                    {sim.lastResult?.hash_verification?.tamper_detected && (
                        <span className="text-red-600 dark:text-red-400 font-semibold animate-pulse">🚨 TAMPER DETECTED</span>
                    )}
                    {sim.lastResult?.status === "delivered" && (
                        <span className="text-green-600 dark:text-green-400 font-semibold">✅ DELIVERED</span>
                    )}
                </div>
            </div>
        </div>
    );
}

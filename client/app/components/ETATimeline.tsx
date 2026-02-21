"use client";
import React from "react";
import type { Shipment } from "../page";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Props { shipment: Shipment | null; }

export default function ETATimeline({ shipment }: Props) {
    if (!shipment) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-base">🗺️ ETA Timeline</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8 text-sm">Select a shipment to view timeline</p>
                </CardContent>
            </Card>
        );
    }

    const route = shipment.route || [];
    const formatDate = (iso: string | null) => {
        if (!iso) return "—";
        try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
        catch { return iso; }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    🗺️ ETA Timeline
                    <span className="text-xs font-normal text-muted-foreground">{shipment.shipment_id}</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative pl-6">
                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-foreground/20 via-foreground/10 to-transparent" />

                    {route.map((node, i) => {
                        const isCompleted = !!node.actual_arrival;
                        const isCurrent = !isCompleted && (i === 0 || !!route[i - 1]?.actual_arrival);
                        const isDelayed = node.expected_arrival && node.eta && new Date(node.eta) > new Date(node.expected_arrival);

                        return (
                            <div
                                key={node.location_code}
                                className="animate-fade-in relative group"
                                style={{ paddingBottom: i === route.length - 1 ? 0 : "20px", animationDelay: `${i * 60}ms` }}
                            >
                                <div className={`absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-300 ${isCompleted
                                    ? "bg-green-500 shadow-sm shadow-green-500/30"
                                    : isCurrent
                                        ? "bg-foreground shadow-md shadow-foreground/20 scale-110"
                                        : "bg-secondary"
                                    }`} />

                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`font-semibold text-sm transition-colors ${isCompleted ? "text-green-600 dark:text-green-400" : isCurrent ? "text-foreground" : "text-muted-foreground"}
                                            }`}>
                                            {node.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/60 bg-secondary/60 px-1.5 py-0.5 rounded">
                                            {node.location_code}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex gap-3">
                                        {isCompleted && <span className="text-green-600 dark:text-green-400">✅ {formatDate(node.actual_arrival)}</span>}
                                        {node.eta && !isCompleted && (
                                            <span className={isDelayed ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                                                {isDelayed ? "⚠️" : "🕐"} ETA: {formatDate(node.eta)}
                                            </span>
                                        )}
                                        {node.expected_arrival && <span>📅 {formatDate(node.expected_arrival)}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

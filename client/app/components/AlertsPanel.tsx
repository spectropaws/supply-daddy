"use client";
import React from "react";
import type { Anomaly } from "../page";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const severityConfig: Record<string, { text: string; bg: string }> = {
    CRITICAL: { text: "text-red-400", bg: "bg-red-500/8" },
    HIGH: { text: "text-amber-400", bg: "bg-amber-500/8" },
    MEDIUM: { text: "text-blue-400", bg: "bg-blue-500/8" },
    LOW: { text: "text-green-400", bg: "bg-green-500/8" },
};

const anomalyLabels: Record<string, string> = {
    TEMPERATURE_BREACH: "🌡️ Temperature Breach",
    WEIGHT_DEVIATION: "⚖️ Weight Deviation",
    DELAY: "⏱️ Delay",
    HUMIDITY_BREACH: "💧 Humidity Breach",
};

interface Props { anomalies: Anomaly[]; }

export default function AlertsPanel({ anomalies }: Props) {
    const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

    return (
        <Card className="max-h-[500px] overflow-y-auto">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    🚨 Risk Alerts
                    {unresolvedAnomalies.length > 0 && (
                        <span className="text-[11px] font-medium text-red-400 bg-red-500/8 px-2 py-0.5 rounded-full">
                            {unresolvedAnomalies.length} active
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {unresolvedAnomalies.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p className="text-3xl mb-2 animate-float">✅</p>
                        <p className="text-sm">All clear — no active alerts</p>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {unresolvedAnomalies.map((a, i) => {
                        const sev = severityConfig[a.severity] || severityConfig.MEDIUM;
                        return (
                            <div
                                key={`${a.shipment_id}-${a.anomaly_type}-${i}`}
                                className={`animate-fade-in rounded-lg p-3 ${sev.bg} transition-all duration-200 hover:shadow-sm`}
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <span className={`text-[13px] font-semibold ${sev.text}`}>
                                            {anomalyLabels[a.anomaly_type] || a.anomaly_type}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground ml-2">{a.shipment_id}</span>
                                    </div>
                                    <span className={`text-[10px] font-semibold ${sev.text} bg-background/30 px-1.5 py-0.5 rounded`}>
                                        {a.severity}
                                    </span>
                                </div>

                                {a.location_code && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">📍 {a.location_code}</p>
                                )}

                                {a.genai_assessment && (
                                    <div className="mt-2 p-2.5 rounded-md bg-card/50 text-xs leading-relaxed">
                                        <span className="font-semibold text-purple-400 text-[11px]">🤖 AI Assessment</span>
                                        <p className="text-muted-foreground mt-1">{a.genai_assessment.risk_assessment}</p>
                                        <p className="text-amber-400/80 mt-1 font-medium text-[11px]">→ {a.genai_assessment.recommended_action}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

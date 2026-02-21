"use client";
import React from "react";
import type { Anomaly } from "../page";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const severityConfig: Record<string, { text: string; bg: string }> = {
    critical: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    CRITICAL: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    HIGH: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    high: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    MEDIUM: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    medium: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    LOW: { text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    low: { text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
};

const anomalyLabels: Record<string, string> = {
    TEMPERATURE_BREACH: "🌡️ Temperature Breach",
    WEIGHT_DEVIATION: "⚖️ Weight Deviation",
    DELAY: "⏱️ Delay",
    HUMIDITY_BREACH: "💧 Humidity Breach",
    document_tampered: "🔓 Document Tampered",
    hash_mismatch: "🔗 Hash Mismatch",
};

interface Props { anomalies: Anomaly[]; }

export default function AlertsPanel({ anomalies }: Props) {
    const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

    // Separate tamper anomalies for prominent display
    const tamperAnomalies = unresolvedAnomalies.filter(
        (a) => a.anomaly_type === "document_tampered" || a.anomaly_type === "hash_mismatch"
    );
    const otherAnomalies = unresolvedAnomalies.filter(
        (a) => a.anomaly_type !== "document_tampered" && a.anomaly_type !== "hash_mismatch"
    );

    return (
        <Card className="max-h-[500px] overflow-y-auto">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    🚨 Risk Alerts
                    {unresolvedAnomalies.length > 0 && (
                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
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

                {/* Tamper alerts — displayed prominently */}
                {tamperAnomalies.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {tamperAnomalies.map((a, i) => (
                            <div
                                key={`tamper-${a.shipment_id}-${i}`}
                                className="animate-fade-in rounded-lg p-3 bg-red-500/10 border border-red-500/20 transition-all duration-200"
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <div>
                                        <span className="text-[13px] font-semibold text-red-600 dark:text-red-400">
                                            🔓 Document Tampered
                                        </span>
                                        <span className="text-[11px] text-muted-foreground ml-2">{a.shipment_id}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/15 px-2 py-0.5 rounded animate-pulse">
                                        CRITICAL
                                    </span>
                                </div>
                                {a.location_code && (
                                    <p className="text-[11px] text-muted-foreground">📍 Detected at: <strong className="text-red-600 dark:text-red-300">{a.location_code}</strong></p>
                                )}
                                <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
                                    {a.details?.message || "Document hash does not match on-chain record. Possible tampering detected."}
                                </p>
                                {a.details?.expected_hash && a.details?.current_hash && (
                                    <div className="mt-2 p-2 rounded bg-red-500/5 font-mono text-[10px] space-y-0.5">
                                        <p className="text-muted-foreground">
                                            On-chain: <span className="text-green-600 dark:text-green-400">{String(a.details.expected_hash).slice(0, 16)}...</span>
                                        </p>
                                        <p className="text-muted-foreground">
                                            Current:  <span className="text-red-600 dark:text-red-400">{String(a.details.current_hash).slice(0, 16)}...</span>
                                        </p>
                                    </div>
                                )}

                                {/* GenAI Assessment for tamper anomalies */}
                                {a.genai_assessment && (
                                    <div className="mt-2 p-2.5 rounded-md bg-card/50 border border-border/30 text-xs leading-relaxed">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400 text-[11px]">🤖 AI Assessment</span>
                                        <p className="text-muted-foreground mt-1">{a.genai_assessment.risk_assessment}</p>
                                        {a.genai_assessment.business_impact && (
                                            <p className="text-muted-foreground mt-1"><strong>Impact:</strong> {a.genai_assessment.business_impact}</p>
                                        )}
                                        <p className="text-amber-600 dark:text-amber-400 mt-1 font-medium text-[11px]">→ {a.genai_assessment.recommended_action}</p>
                                    </div>
                                )}
                                {!a.genai_assessment && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                                        ⚠️ Manufacturer and receiver have been notified
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Other anomalies */}
                <div className="flex flex-col gap-2">
                    {otherAnomalies.map((a, i) => {
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
                                    <div className="mt-2 p-2.5 rounded-md bg-card/50 border border-border/30 text-xs leading-relaxed">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400 text-[11px]">🤖 AI Assessment</span>
                                        <p className="text-muted-foreground mt-1">{a.genai_assessment.risk_assessment}</p>
                                        {a.genai_assessment.business_impact && (
                                            <p className="text-muted-foreground mt-1"><strong>Impact:</strong> {a.genai_assessment.business_impact}</p>
                                        )}
                                        <p className="text-amber-600 dark:text-amber-400 mt-1 font-medium text-[11px]">→ {a.genai_assessment.recommended_action}</p>
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

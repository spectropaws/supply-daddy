"use client";
import React, { useState, useEffect } from "react";
import type { Shipment } from "../page";

interface Props {
    shipment: Shipment | null;
    apiBase: string;
}

interface BlockchainCheckpoint {
    index: number;
    location_code: string;
    timestamp: number;
    weight_kg: number;
    document_hash: string;
    scanned_by: string;
}

export default function BlockchainPanel({ shipment, apiBase }: Props) {
    const [checkpoints, setCheckpoints] = useState<BlockchainCheckpoint[]>([]);

    useEffect(() => {
        // For now, we show the tx hashes from the shipment data
        // On-chain reads would go through the backend
        setCheckpoints([]);
    }, [shipment]);

    const cardStyle: React.CSSProperties = {
        background: "var(--bg-card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
    };

    const txHashes = shipment?.blockchain_tx_hashes || [];

    return (
        <div style={cardStyle}>
            <h2
                style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                }}
            >
                ⛓️ Blockchain Anchors
                {txHashes.length > 0 && (
                    <span
                        style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: "rgba(16,185,129,0.12)",
                            color: "var(--accent-green)",
                        }}
                    >
                        {txHashes.length} anchored
                    </span>
                )}
            </h2>

            {!shipment && (
                <p
                    style={{
                        color: "var(--text-muted)",
                        textAlign: "center",
                        padding: "24px",
                        fontSize: "14px",
                    }}
                >
                    Select a shipment to view anchors
                </p>
            )}

            {shipment && txHashes.length === 0 && (
                <div
                    style={{
                        textAlign: "center",
                        padding: "24px",
                        color: "var(--text-muted)",
                    }}
                >
                    <p style={{ fontSize: "28px", margin: "0 0 8px 0" }}>🔗</p>
                    <p style={{ fontSize: "14px", margin: 0 }}>
                        No blockchain anchors yet
                    </p>
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {txHashes.map((hash, i) => (
                    <div
                        key={hash}
                        className="animate-fade-in"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "10px 14px",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-color)",
                            animationDelay: `${i * 0.05}s`,
                        }}
                    >
                        <div
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "var(--gradient-success)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "14px",
                                flexShrink: 0,
                            }}
                        >
                            #{i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                                style={{
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    color: "var(--accent-green)",
                                    margin: 0,
                                }}
                            >
                                Checkpoint Anchored
                            </p>
                            <p
                                style={{
                                    fontSize: "11px",
                                    color: "var(--text-muted)",
                                    margin: "2px 0 0 0",
                                    fontFamily: "var(--font-mono)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                                title={hash}
                            >
                                {hash === "0x" + "0".repeat(64)
                                    ? "Stubbed (no blockchain connected)"
                                    : hash}
                            </p>
                        </div>
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "var(--accent-green)",
                                flexShrink: 0,
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Trust Banner */}
            {shipment && txHashes.length > 0 && (
                <div
                    style={{
                        marginTop: "16px",
                        padding: "12px 16px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.15)",
                        fontSize: "12px",
                        color: "var(--accent-green)",
                        fontWeight: 500,
                        textAlign: "center",
                    }}
                >
                    🛡️ {txHashes.length} immutable record{txHashes.length !== 1 && "s"}{" "}
                    anchored on-chain
                </div>
            )}
        </div>
    );
}

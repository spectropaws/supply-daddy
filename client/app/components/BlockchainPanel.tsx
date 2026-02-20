"use client";
import React, { useState, useEffect } from "react";
import type { Shipment } from "../page";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Props { shipment: Shipment | null; apiBase: string; }
interface BlockchainCheckpoint { index: number; location_code: string; timestamp: number; weight_kg: number; document_hash: string; scanned_by: string; }

export default function BlockchainPanel({ shipment, apiBase }: Props) {
    const [checkpoints, setCheckpoints] = useState<BlockchainCheckpoint[]>([]);
    useEffect(() => { setCheckpoints([]); }, [shipment]);

    const txHashes = shipment?.blockchain_tx_hashes || [];

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    ⛓️ Blockchain Anchors
                    {txHashes.length > 0 && (
                        <span className="text-[11px] font-medium text-green-400 bg-green-500/8 px-2 py-0.5 rounded-full">
                            {txHashes.length} anchored
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!shipment && (
                    <p className="text-muted-foreground text-center py-8 text-sm">
                        Select a shipment to view anchors
                    </p>
                )}

                {shipment && txHashes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-3xl mb-2 animate-float">🔗</p>
                        <p className="text-sm">No blockchain anchors yet</p>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    {txHashes.map((hash, i) => (
                        <div
                            key={hash}
                            className="animate-fade-in flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40 transition-all duration-200 hover:bg-secondary/60 group"
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-green-500/80 to-cyan-500/80 flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm group-hover:shadow-md group-hover:shadow-green-500/10 transition-shadow">
                                #{i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-green-400/80">Checkpoint Anchored</p>
                                <p className="text-[10px] text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap mt-0.5" title={hash}>
                                    {hash === "0x" + "0".repeat(64) ? "Stubbed (no blockchain connected)" : hash}
                                </p>
                            </div>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        </div>
                    ))}
                </div>

                {shipment && txHashes.length > 0 && (
                    <div className="mt-4 p-2.5 rounded-lg bg-green-500/5 text-[11px] text-green-400/80 font-medium text-center">
                        🛡️ {txHashes.length} immutable record{txHashes.length !== 1 && "s"} anchored on-chain
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

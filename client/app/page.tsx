"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./components/AuthContext";
import ShipmentPanel from "./components/ShipmentPanel";
import AlertsPanel from "./components/AlertsPanel";
import BlockchainPanel from "./components/BlockchainPanel";
import ETATimeline from "./components/ETATimeline";
import GodMode from "./components/GodMode";
import RouteGraph from "./components/RouteGraph";
import SimulationBar from "./components/SimulationBar";
import { apiFetch, API_BASE } from "./lib/apiFetch";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { useTheme } from "./components/ThemeContext";

export type Role = "manufacturer" | "receiver";

export interface Shipment {
  shipment_id: string;
  origin: string;
  destination: string;
  manufacturer_id: string;
  receiver_id: string;
  route: RouteNode[];
  risk_profile: RiskProfile | null;
  current_status: string;
  blockchain_tx_hashes: string[];
  created_at?: string;
  doc_hash?: string;
  po_text?: string;
  invoice_text?: string;
  bol_text?: string;
}

export interface RouteNode {
  location_code: string;
  name: string;
  expected_arrival: string | null;
  actual_arrival: string | null;
  eta: string | null;
}

export interface RiskProfile {
  product_category: string;
  risk_flags: string[];
  hazard_class: string | null;
  compliance_required: string[];
  confidence_score: number;
}

export interface Anomaly {
  shipment_id: string;
  anomaly_type: string;
  severity: string;
  details: Record<string, any>;
  location_code: string;
  resolved: boolean;
  created_at: string;
  genai_assessment?: {
    risk_assessment: string;
    business_impact: string;
    recommended_action: string;
    severity_level: string;
  };
}

const roleLabels: Record<Role, { label: string; icon: string }> = {
  manufacturer: { label: "Manufacturer", icon: "🏭" },
  receiver: { label: "Receiver", icon: "📦" },
};

export default function Home() {
  const { user, token, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [godModeOpen, setGodModeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const role = user?.role as Role | undefined;

  const authHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const fetchShipments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/shipments/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
        if (data.length > 0) {
          setSelectedShipment(prev => prev || data[0]);
        }
      }
    } catch (e) { console.error("Failed to fetch shipments:", e); }
  }, [token, authHeaders]);

  const fetchAnomalies = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/anomalies`, { headers: authHeaders() });
      if (res.ok) setAnomalies(await res.json());
    } catch (e) { console.error("Failed to fetch anomalies:", e); }
  }, [token, authHeaders]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchShipments(), fetchAnomalies()]);
    if (selectedShipment && token) {
      try {
        const res = await apiFetch(`${API_BASE}/shipments/${selectedShipment.shipment_id}`, { headers: authHeaders() });
        if (res.ok) setSelectedShipment(await res.json());
      } catch (e) { console.error(e); }
    }
    setLoading(false);
  }, [fetchShipments, fetchAnomalies, selectedShipment, token, authHeaders]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchShipments();
    fetchAnomalies();
    // Background 10s polling removed per request
  }, [isAuthenticated, fetchShipments, fetchAnomalies]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-float">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg shadow-blue-500/20">
            S
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !role) {
    // Redirect to login if not authenticated
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 px-8 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-sm shadow-black/5">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg font-extrabold text-white shadow-md shadow-blue-500/25 transition-transform hover:scale-105 duration-200">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">Supply Daddy</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Decentralized Logistics</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="gap-1.5 text-foreground/70 border-border/60 font-medium text-xs">
            <span>{roleLabels[role].icon}</span>
            {roleLabels[role].label}
          </Badge>

          <span className="text-xs text-muted-foreground font-medium px-1">{user.username}</span>

          <Button variant="ghost" size="sm" onClick={refreshAll} className="text-xs text-muted-foreground hover:text-foreground">
            {loading ? "⟳ Syncing..." : "↻ Refresh"}
          </Button>

          <Button variant="ghost" size="sm" onClick={toggleTheme} className="text-xs text-muted-foreground hover:text-foreground w-8 h-8 p-0" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === "dark" ? "☀️" : "🌙"}
          </Button>

          <Button
            size="sm"
            onClick={() => setGodModeOpen(!godModeOpen)}
            className={`text-xs transition-all duration-300 ${godModeOpen
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
              : "bg-secondary text-purple-600 dark:text-purple-400 hover:bg-secondary/80"
              }`}
          >
            ⚡ God Mode
          </Button>

          <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
            Logout
          </Button>
        </div>
      </header>

      {/* Simulation Bar — auto-transfers, pauses on God Mode */}
      <SimulationBar
        shipments={shipments}
        paused={godModeOpen}
        token={token}
        onCheckpointComplete={refreshAll}
        secondsPerHour={1}
      />

      {/* God Mode Panel */}
      {godModeOpen && (
        <div className="animate-slide-down">
          <GodMode shipments={shipments} onAction={refreshAll} apiBase={API_BASE} token={token} />
        </div>
      )}

      {/* Main Content — 3-column: sidebar / hero graph / sidebar */}
      <main className="flex-1 p-5 max-w-[1800px] w-full mx-auto">
        <div className="grid grid-cols-[320px_1fr_340px] gap-4 h-[calc(100vh-120px)]">

          {/* Left Sidebar — Shipments */}
          <div className="animate-fade-in-scale overflow-y-auto">
            <ShipmentPanel shipments={shipments} selectedShipment={selectedShipment} onSelect={setSelectedShipment} onCreated={refreshAll} apiBase={API_BASE} role={role} token={token} />
          </div>

          {/* Center — Route Graph (hero) */}
          <div className="animate-fade-in-scale flex flex-col gap-4" style={{ animationDelay: '50ms' }}>
            <div className="flex-1 min-h-[500px]">
              <RouteGraph
                shipment={selectedShipment}
                anomalies={anomalies.filter((a) => a.shipment_id === selectedShipment?.shipment_id)}
              />
            </div>
            {/* ETA Timeline sits below the graph for receiver role */}
            {role === "receiver" && (
              <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                <ETATimeline shipment={selectedShipment} />
              </div>
            )}
          </div>

          {/* Right Sidebar — Alerts + Blockchain/ETA stacked */}
          <div className="flex flex-col gap-4 overflow-y-auto animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
            <AlertsPanel anomalies={anomalies} />
            <BlockchainPanel shipment={selectedShipment} apiBase={API_BASE} />
          </div>

        </div>
      </main>
    </div>
  );
}

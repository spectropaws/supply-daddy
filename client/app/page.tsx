"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./components/AuthContext";
import ShipmentPanel from "./components/ShipmentPanel";
import AlertsPanel from "./components/AlertsPanel";
import BlockchainPanel from "./components/BlockchainPanel";
import ETATimeline from "./components/ETATimeline";
import GodMode from "./components/GodMode";
import RouteGraph from "./components/RouteGraph";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Role = "manufacturer" | "transit_node" | "receiver";

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
  transit_node: { label: "Transit Node", icon: "🚚" },
  receiver: { label: "Receiver", icon: "📦" },
};

export default function Home() {
  const { user, token, isAuthenticated, loading: authLoading, logout } = useAuth();
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
      const res = await fetch(`${API_BASE}/shipments/`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
        if (data.length > 0 && !selectedShipment) {
          setSelectedShipment(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch shipments:", e);
    }
  }, [token, authHeaders, selectedShipment]);

  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/anomalies`);
      if (res.ok) {
        setAnomalies(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch anomalies:", e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchShipments(), fetchAnomalies()]);
    if (selectedShipment && token) {
      try {
        const res = await fetch(
          `${API_BASE}/shipments/${selectedShipment.shipment_id}`,
          { headers: authHeaders() }
        );
        if (res.ok) setSelectedShipment(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
    setLoading(false);
  }, [fetchShipments, fetchAnomalies, selectedShipment, token, authHeaders]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchShipments();
    fetchAnomalies();
    const interval = setInterval(() => {
      fetchShipments();
      fetchAnomalies();
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchShipments, fetchAnomalies]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !role) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: "var(--radius-sm)",
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", fontWeight: 800, color: "white",
            }}
          >
            S
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>
              Supply Daddy
            </h1>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              Decentralized Logistics Platform
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Role Badge */}
          <div
            style={{
              padding: "6px 14px", borderRadius: "20px",
              background: "var(--bg-card)", border: "1px solid var(--accent-blue)",
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)",
            }}
          >
            <span>{roleLabels[role].icon}</span>
            {roleLabels[role].label}
          </div>

          {/* User */}
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
            {user.username}
          </span>

          <button
            onClick={refreshAll}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)",
              background: "var(--bg-card)", border: "1px solid var(--border-color)",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px", fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {loading ? "⟳ Syncing..." : "↻ Refresh"}
          </button>

          <button
            onClick={() => setGodModeOpen(!godModeOpen)}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)",
              background: godModeOpen ? "var(--gradient-god)" : "var(--bg-card)",
              border: godModeOpen ? "none" : "1px solid var(--border-color)",
              color: godModeOpen ? "white" : "var(--accent-purple)",
              cursor: "pointer", fontSize: "13px", fontWeight: 600,
            }}
          >
            ⚡ God Mode
          </button>

          <button
            onClick={logout}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)",
              background: "var(--bg-card)", border: "1px solid var(--border-color)",
              color: "var(--accent-red)", cursor: "pointer", fontSize: "13px", fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* God Mode Panel */}
      {godModeOpen && (
        <div className="animate-slide-down">
          <GodMode shipments={shipments} onAction={refreshAll} apiBase={API_BASE} />
        </div>
      )}

      {/* Main Content — role-based layout */}
      <main
        style={{
          flex: 1, padding: "24px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto",
          gap: "24px",
          maxWidth: "1600px", width: "100%", margin: "0 auto",
        }}
      >
        {/* Manufacturer Layout */}
        {role === "manufacturer" && (
          <>
            <div>
              <ShipmentPanel
                shipments={shipments}
                selectedShipment={selectedShipment}
                onSelect={setSelectedShipment}
                onCreated={refreshAll}
                apiBase={API_BASE}
                role={role}
                token={token}
              />
            </div>
            <div>
              <RouteGraph shipment={selectedShipment} />
            </div>
            <div>
              <AlertsPanel anomalies={anomalies} />
            </div>
            <div>
              <BlockchainPanel shipment={selectedShipment} apiBase={API_BASE} />
            </div>
          </>
        )}

        {/* Transit Node Layout */}
        {role === "transit_node" && (
          <>
            <div>
              <ShipmentPanel
                shipments={shipments}
                selectedShipment={selectedShipment}
                onSelect={setSelectedShipment}
                onCreated={refreshAll}
                apiBase={API_BASE}
                role={role}
                token={token}
              />
            </div>
            <div>
              <ETATimeline shipment={selectedShipment} />
            </div>
            <div>
              <AlertsPanel anomalies={anomalies} />
            </div>
            <div>
              <BlockchainPanel shipment={selectedShipment} apiBase={API_BASE} />
            </div>
          </>
        )}

        {/* Receiver Layout */}
        {role === "receiver" && (
          <>
            <div>
              <ShipmentPanel
                shipments={shipments}
                selectedShipment={selectedShipment}
                onSelect={setSelectedShipment}
                onCreated={refreshAll}
                apiBase={API_BASE}
                role={role}
                token={token}
              />
            </div>
            <div>
              <RouteGraph shipment={selectedShipment} />
            </div>
            <div>
              <AlertsPanel anomalies={anomalies} />
            </div>
            <div>
              <ETATimeline shipment={selectedShipment} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

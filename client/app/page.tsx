"use client";

import React, { useState, useEffect, useCallback } from "react";
import RoleSwitcher from "./components/RoleSwitcher";
import ShipmentPanel from "./components/ShipmentPanel";
import AlertsPanel from "./components/AlertsPanel";
import BlockchainPanel from "./components/BlockchainPanel";
import ETATimeline from "./components/ETATimeline";
import GodMode from "./components/GodMode";

const API_BASE = "http://localhost:8000";

export type Role = "manufacturer" | "transit" | "receiver";

export interface Shipment {
  shipment_id: string;
  origin: string;
  destination: string;
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

export default function Home() {
  const [role, setRole] = useState<Role>("manufacturer");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [godModeOpen, setGodModeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/shipments/`);
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
  }, [selectedShipment]);

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
    // Refresh selected shipment
    if (selectedShipment) {
      try {
        const res = await fetch(`${API_BASE}/shipments/${selectedShipment.shipment_id}`);
        if (res.ok) setSelectedShipment(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
    setLoading(false);
  }, [fetchShipments, fetchAnomalies, selectedShipment]);

  useEffect(() => {
    fetchShipments();
    fetchAnomalies();
    const interval = setInterval(() => {
      fetchShipments();
      fetchAnomalies();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchShipments, fetchAnomalies]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 800,
              color: "white",
            }}
          >
            S
          </div>
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Supply Daddy
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Decentralized Logistics Platform
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <RoleSwitcher role={role} onRoleChange={setRole} />
          <button
            onClick={refreshAll}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "var(--accent-blue)";
              (e.target as HTMLButtonElement).style.color = "var(--accent-blue)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "var(--border-color)";
              (e.target as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            {loading ? "⟳ Syncing..." : "↻ Refresh"}
          </button>
          <button
            onClick={() => setGodModeOpen(!godModeOpen)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              background: godModeOpen ? "var(--gradient-god)" : "var(--bg-card)",
              border: godModeOpen ? "none" : "1px solid var(--border-color)",
              color: godModeOpen ? "white" : "var(--accent-purple)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            ⚡ God Mode
          </button>
        </div>
      </header>

      {/* God Mode Panel */}
      {godModeOpen && (
        <div className="animate-slide-down">
          <GodMode
            shipments={shipments}
            onAction={refreshAll}
            apiBase={API_BASE}
          />
        </div>
      )}

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "24px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto",
          gap: "24px",
          maxWidth: "1600px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Shipments Panel — spans full width on top for manufacturer */}
        <div style={{ gridColumn: role === "manufacturer" ? "1 / -1" : "1 / 2" }}>
          <ShipmentPanel
            shipments={shipments}
            selectedShipment={selectedShipment}
            onSelect={setSelectedShipment}
            onCreated={refreshAll}
            apiBase={API_BASE}
            role={role}
          />
        </div>

        {/* Alerts Panel */}
        <div style={{ gridColumn: role === "manufacturer" ? "1 / 2" : "2 / 3" }}>
          <AlertsPanel anomalies={anomalies} />
        </div>

        {/* ETA Timeline */}
        <div>
          <ETATimeline shipment={selectedShipment} />
        </div>

        {/* Blockchain Panel */}
        <div>
          <BlockchainPanel
            shipment={selectedShipment}
            apiBase={API_BASE}
          />
        </div>
      </main>
    </div>
  );
}

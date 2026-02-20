"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GraphNode {
    code: string;
    name: string;
}

export default function LoginPage() {
    const { login, register, isAuthenticated } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [availableNodes, setAvailableNodes] = useState<GraphNode[]>([]);

    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        role: "manufacturer",
        node_codes: [] as string[],
    });

    useEffect(() => {
        fetch(`${API_BASE}/routes/nodes`)
            .then((r) => r.json())
            .then(setAvailableNodes)
            .catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (mode === "register") {
                await register({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    role: form.role,
                    node_codes: form.role === "transit_node" ? form.node_codes : [],
                });
            } else {
                await login(form.email, form.password);
            }
        } catch (e: any) {
            setError(e.message || "Something went wrong");
        }
        setLoading(false);
    };

    const toggleNode = (code: string) => {
        setForm((f) => ({
            ...f,
            node_codes: f.node_codes.includes(code)
                ? f.node_codes.filter((c) => c !== code)
                : [...f.node_codes, code],
        }));
    };

    if (isAuthenticated) return null;

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        border: "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
        fontSize: "14px",
        outline: "none",
        transition: "border-color 0.2s",
    };

    const roles = [
        { key: "manufacturer", label: "Manufacturer", icon: "🏭", desc: "Create & track shipments" },
        { key: "transit_node", label: "Transit Node", icon: "🚚", desc: "Operate relay hubs" },
        { key: "receiver", label: "Receiver", icon: "📦", desc: "Receive shipments" },
    ];

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--bg-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: mode === "register" ? "520px" : "440px",
                    background: "var(--bg-card)",
                    borderRadius: "16px",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                    padding: "40px",
                    transition: "max-width 0.3s",
                }}
            >
                {/* Branding */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: "12px",
                            background: "var(--gradient-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            fontWeight: 800,
                            color: "white",
                            marginBottom: "12px",
                        }}
                    >
                        S
                    </div>
                    <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 4px 0", color: "var(--text-primary)" }}>
                        Supply Daddy
                    </h1>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                        Decentralized Logistics Platform
                    </p>
                </div>

                {/* Mode Tabs */}
                <div style={{ display: "flex", gap: "4px", background: "var(--bg-secondary)", borderRadius: "8px", padding: "4px", marginBottom: "24px" }}>
                    {(["login", "register"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setError(""); }}
                            style={{
                                flex: 1,
                                padding: "10px",
                                borderRadius: "6px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: mode === m ? 600 : 400,
                                color: mode === m ? "white" : "var(--text-muted)",
                                background: mode === m ? "var(--gradient-primary)" : "transparent",
                                transition: "all 0.2s",
                            }}
                        >
                            {m === "login" ? "Sign In" : "Create Account"}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Username (register only) */}
                    {mode === "register" && (
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                                Username
                            </label>
                            <input
                                style={inputStyle}
                                placeholder="Your name"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {/* Email */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                            Email
                        </label>
                        <input
                            type="email"
                            style={inputStyle}
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                            Password
                        </label>
                        <input
                            type="password"
                            style={inputStyle}
                            placeholder="Min 6 characters"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            minLength={6}
                        />
                    </div>

                    {/* Role selector (register only) */}
                    {mode === "register" && (
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                                Your Role
                            </label>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {roles.map((r) => (
                                    <button
                                        key={r.key}
                                        type="button"
                                        onClick={() => setForm({ ...form, role: r.key, node_codes: [] })}
                                        style={{
                                            flex: 1,
                                            padding: "12px 8px",
                                            borderRadius: "8px",
                                            border: form.role === r.key ? "2px solid var(--accent-blue)" : "1px solid var(--border-color)",
                                            background: form.role === r.key ? "rgba(59,130,246,0.08)" : "var(--bg-secondary)",
                                            cursor: "pointer",
                                            transition: "all 0.15s",
                                            textAlign: "center",
                                        }}
                                    >
                                        <div style={{ fontSize: "24px", marginBottom: "4px" }}>{r.icon}</div>
                                        <div style={{ fontSize: "12px", fontWeight: 600, color: form.role === r.key ? "var(--accent-blue)" : "var(--text-primary)" }}>
                                            {r.label}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                                            {r.desc}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Node selection for transit nodes */}
                    {mode === "register" && form.role === "transit_node" && (
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                                Select Your Nodes
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {availableNodes.map((n) => (
                                    <button
                                        key={n.code}
                                        type="button"
                                        onClick={() => toggleNode(n.code)}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: "16px",
                                            border: form.node_codes.includes(n.code)
                                                ? "1px solid var(--accent-cyan)"
                                                : "1px solid var(--border-color)",
                                            background: form.node_codes.includes(n.code)
                                                ? "rgba(6,182,212,0.1)"
                                                : "var(--bg-secondary)",
                                            color: form.node_codes.includes(n.code) ? "var(--accent-cyan)" : "var(--text-muted)",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {n.code} — {n.name}
                                    </button>
                                ))}
                            </div>
                            {form.node_codes.length === 0 && (
                                <p style={{ fontSize: "11px", color: "var(--accent-amber)", marginTop: "6px" }}>
                                    ⚠️ Select at least one node to operate
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--accent-red)", fontSize: "13px", marginBottom: "14px" }}>
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || (mode === "register" && form.role === "transit_node" && form.node_codes.length === 0)}
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "8px",
                            border: "none",
                            background: loading ? "var(--text-muted)" : "var(--gradient-primary)",
                            color: "white",
                            fontSize: "15px",
                            fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            marginTop: "8px",
                        }}
                    >
                        {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
                    </button>
                </form>
            </div>
        </div>
    );
}

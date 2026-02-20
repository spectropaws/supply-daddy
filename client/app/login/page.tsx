"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";
import { apiFetch, API_BASE } from "../lib/apiFetch";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

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
        apiFetch(`${API_BASE}/routes/nodes`)
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

    const roles = [
        { key: "manufacturer", label: "Manufacturer", icon: "🏭", desc: "Create & track" },
        { key: "transit_node", label: "Transit Node", icon: "🚚", desc: "Operate hubs" },
        { key: "receiver", label: "Receiver", icon: "📦", desc: "Receive goods" },
    ];

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            {/* Subtle background glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/3 rounded-full blur-[120px]" />
            </div>

            <Card className={`relative w-full ${mode === "register" ? "max-w-[520px]" : "max-w-[420px]"} shadow-2xl shadow-black/30 animate-fade-in-scale transition-all duration-300`}>
                <CardHeader className="text-center pb-1 pt-8">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 inline-flex items-center justify-center text-3xl font-extrabold text-white mx-auto mb-4 shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 duration-200">
                        S
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Supply Daddy</CardTitle>
                    <CardDescription className="text-xs">Decentralized Logistics Platform</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {/* Mode Tabs */}
                    <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-6">
                        {(["login", "register"] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(""); }}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${mode === m
                                        ? "bg-foreground text-background shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {m === "login" ? "Sign In" : "Create Account"}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {mode === "register" && (
                            <div className="space-y-1.5 animate-fade-in">
                                <Label className="text-xs text-muted-foreground">Username</Label>
                                <Input placeholder="Your name" value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <Input type="email" placeholder="you@example.com" value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Password</Label>
                            <Input type="password" placeholder="Min 6 characters" value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                        </div>

                        {mode === "register" && (
                            <div className="space-y-2 animate-fade-in">
                                <Label className="text-xs text-muted-foreground">Your Role</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {roles.map((r) => (
                                        <button
                                            key={r.key}
                                            type="button"
                                            onClick={() => setForm({ ...form, role: r.key, node_codes: [] })}
                                            className={`p-3 rounded-lg text-center transition-all duration-200 cursor-pointer ${form.role === r.key
                                                    ? "bg-foreground/5 ring-1 ring-foreground/20 shadow-sm"
                                                    : "bg-secondary/50 hover:bg-secondary/80"
                                                }`}
                                        >
                                            <div className="text-xl mb-0.5">{r.icon}</div>
                                            <div className={`text-[11px] font-semibold ${form.role === r.key ? "text-foreground" : "text-muted-foreground"}`}>
                                                {r.label}
                                            </div>
                                            <div className="text-[9px] text-muted-foreground mt-0.5">{r.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === "register" && form.role === "transit_node" && (
                            <div className="space-y-2 animate-fade-in">
                                <Label className="text-xs text-muted-foreground">Select Your Nodes</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableNodes.map((n) => (
                                        <button
                                            key={n.code}
                                            type="button"
                                            onClick={() => toggleNode(n.code)}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer ${form.node_codes.includes(n.code)
                                                    ? "bg-foreground text-background shadow-sm"
                                                    : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                                }`}
                                        >
                                            {n.code} — {n.name}
                                        </button>
                                    ))}
                                </div>
                                {form.node_codes.length === 0 && (
                                    <p className="text-[11px] text-amber-400/80">⚠️ Select at least one node</p>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="animate-fade-in p-2.5 rounded-lg bg-red-500/8 text-red-400 text-xs">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || (mode === "register" && form.role === "transit_node" && form.node_codes.length === 0)}
                            className="w-full h-10 font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 mt-2"
                        >
                            {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

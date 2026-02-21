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
    const { login, register, loginWithGoogle, resetPassword, isAuthenticated, needsRole, setupRole, firebaseUser } = useAuth();
    const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
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
        setSuccess("");
        setLoading(true);
        try {
            if (mode === "forgot") {
                await resetPassword(form.email);
                setSuccess("Password reset email sent! Check your inbox.");
            } else if (mode === "register") {
                await register({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                });
                // After register, needsRole will be true → role selection shown
            } else {
                await login(form.email, form.password);
            }
        } catch (e: any) {
            const msg = e.code === "auth/invalid-credential"
                ? "Invalid email or password"
                : e.code === "auth/email-already-in-use"
                    ? "Email already registered. Try signing in."
                    : e.code === "auth/weak-password"
                        ? "Password must be at least 6 characters"
                        : e.code === "auth/user-not-found"
                            ? "No account found with this email"
                            : e.message || "Something went wrong";
            setError(msg);
        }
        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setLoading(true);
        try {
            await loginWithGoogle();
        } catch (e: any) {
            setError(e.message || "Google sign-in failed");
        }
        setLoading(false);
    };

    const handleRoleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            await setupRole(form.role, form.node_codes);
        } catch (e: any) {
            setError(e.message || "Role setup failed");
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
        { key: "receiver", label: "Receiver", icon: "📦", desc: "Receive goods" },
    ];

    // ─── Role Selection Modal (first-time users) ───
    if (needsRole && firebaseUser) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/3 rounded-full blur-[120px]" />
                </div>
                <Card className="relative w-full max-w-[520px] shadow-2xl shadow-black/30 animate-fade-in-scale">
                    <CardHeader className="text-center pb-1 pt-8">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 inline-flex items-center justify-center text-3xl font-extrabold text-white mx-auto mb-4 shadow-lg shadow-blue-500/25">
                            S
                        </div>
                        <CardTitle className="text-2xl tracking-tight">Welcome, {firebaseUser.displayName || firebaseUser.email}!</CardTitle>
                        <CardDescription className="text-xs">Select your role to get started</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Your Role</Label>
                            <div className="grid grid-cols-2 gap-2">
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



                        {error && (
                            <div className="animate-fade-in p-2.5 rounded-lg bg-red-500/8 text-red-600 dark:text-red-400 text-xs">{error}</div>
                        )}

                        <Button
                            onClick={handleRoleSubmit}
                            disabled={loading}
                            className="w-full h-10 font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 mt-2"
                        >
                            {loading ? "Setting up..." : "Continue →"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─── Login / Register / Forgot Password ───
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
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
                    {mode !== "forgot" && (
                        <>
                            {/* Google Sign In */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                className="w-full h-10 mb-4 text-sm font-medium gap-2"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                            </Button>

                            {/* Divider */}
                            <div className="relative mb-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border/50" />
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase">
                                    <span className="bg-card px-3 text-muted-foreground">or</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Mode Tabs */}
                    {mode !== "forgot" && (
                        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-6">
                            {(["login", "register"] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${mode === m
                                        ? "bg-foreground text-background shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {m === "login" ? "Sign In" : "Create Account"}
                                </button>
                            ))}
                        </div>
                    )}

                    {mode === "forgot" && (
                        <div className="mb-6">
                            <h3 className="text-base font-semibold text-foreground mb-1">Reset Password</h3>
                            <p className="text-xs text-muted-foreground">Enter your email and we&apos;ll send a reset link.</p>
                        </div>
                    )}

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

                        {mode !== "forgot" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Password</Label>
                                <Input type="password" placeholder="Min 6 characters" value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                            </div>
                        )}

                        {error && (
                            <div className="animate-fade-in p-2.5 rounded-lg bg-red-500/8 text-red-600 dark:text-red-400 text-xs">{error}</div>
                        )}
                        {success && (
                            <div className="animate-fade-in p-2.5 rounded-lg bg-green-500/8 text-green-600 dark:text-green-400 text-xs">{success}</div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10 font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 mt-2"
                        >
                            {loading ? "Please wait..." : mode === "login" ? "Sign In →" : mode === "register" ? "Create Account →" : "Send Reset Link →"}
                        </Button>

                        {mode === "login" && (
                            <button
                                type="button"
                                onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1"
                            >
                                Forgot password?
                            </button>
                        )}

                        {mode === "forgot" && (
                            <button
                                type="button"
                                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1"
                            >
                                ← Back to Sign In
                            </button>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

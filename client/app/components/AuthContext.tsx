"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, API_BASE } from "../lib/apiFetch";

export interface User {
    user_id: string;
    username: string;
    email: string;
    role: "manufacturer" | "transit_node" | "receiver";
    node_codes: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    register: (data: {
        username: string;
        email: string;
        password: string;
        role: string;
        node_codes?: string[];
    }) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Verify stored token on mount
    useEffect(() => {
        const storedToken = localStorage.getItem("sd_token");
        if (!storedToken) {
            setLoading(false);
            return;
        }

        apiFetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Invalid token");
                return res.json();
            })
            .then((data) => {
                setUser(data);
                setToken(storedToken);
            })
            .catch(() => {
                localStorage.removeItem("sd_token");
            })
            .finally(() => setLoading(false));
    }, []);

    // Redirect unauthenticated users to login
    useEffect(() => {
        if (!loading && !user && pathname !== "/login") {
            router.push("/login");
        }
    }, [loading, user, pathname, router]);

    const register = useCallback(
        async (data: {
            username: string;
            email: string;
            password: string;
            role: string;
            node_codes?: string[];
        }) => {
            const res = await apiFetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Registration failed");
            }
            const result = await res.json();
            setUser(result.user);
            setToken(result.token);
            localStorage.setItem("sd_token", result.token);
            router.push("/");
        },
        [router]
    );

    const login = useCallback(
        async (email: string, password: string) => {
            const res = await apiFetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Login failed");
            }
            const result = await res.json();
            setUser(result.user);
            setToken(result.token);
            localStorage.setItem("sd_token", result.token);
            router.push("/");
        },
        [router]
    );

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("sd_token");
        router.push("/login");
    }, [router]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!user,
                loading,
                register,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
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
    firebaseUser: FirebaseUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    needsRole: boolean;
    register: (data: {
        username: string;
        email: string;
        password: string;
    }) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    setupRole: (role: string, node_codes?: string[]) => Promise<void>;
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
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsRole, setNeedsRole] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Sync backend profile from Firebase token
    const syncProfile = useCallback(async (fbUser: FirebaseUser) => {
        try {
            const idToken = await fbUser.getIdToken();
            setToken(idToken);

            const res = await apiFetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${idToken}` },
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setNeedsRole(false);
                return true;
            } else if (res.status === 404) {
                // User exists in Firebase Auth but not in our DB → needs role setup
                setNeedsRole(true);
                return false;
            } else {
                throw new Error("Profile fetch failed");
            }
        } catch (e) {
            console.error("syncProfile error:", e);
            return false;
        }
    }, []);

    // Listen to Firebase auth state
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                await syncProfile(fbUser);
            } else {
                setFirebaseUser(null);
                setUser(null);
                setToken(null);
                setNeedsRole(false);
            }
            setLoading(false);
        });
        return unsub;
    }, [syncProfile]);

    // Redirect unauthenticated users
    useEffect(() => {
        if (!loading && !firebaseUser && pathname !== "/login") {
            router.push("/login");
        }
    }, [loading, firebaseUser, pathname, router]);

    const register = useCallback(
        async (data: { username: string; email: string; password: string }) => {
            const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
            await updateProfile(cred.user, { displayName: data.username });
            setFirebaseUser(cred.user);
            // Don't navigate yet — needs role selection
            const idToken = await cred.user.getIdToken();
            setToken(idToken);
            setNeedsRole(true);
        },
        []
    );

    const login = useCallback(
        async (email: string, password: string) => {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            setFirebaseUser(cred.user);
            const synced = await syncProfile(cred.user);
            if (synced) router.push("/");
        },
        [syncProfile, router]
    );

    const loginWithGoogle = useCallback(async () => {
        const cred = await signInWithPopup(auth, googleProvider);
        setFirebaseUser(cred.user);
        const synced = await syncProfile(cred.user);
        if (synced) router.push("/");
        // If not synced, needsRole will be set
    }, [syncProfile, router]);

    const resetPassword = useCallback(async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    }, []);

    const setupRole = useCallback(
        async (role: string, node_codes?: string[]) => {
            if (!firebaseUser || !token) throw new Error("Not authenticated");
            const idToken = await firebaseUser.getIdToken();
            const res = await apiFetch(`${API_BASE}/auth/setup-role`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    role,
                    node_codes: role === "transit_node" ? node_codes : [],
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Role setup failed");
            }
            const data = await res.json();
            setUser(data.user);
            setNeedsRole(false);
            router.push("/");
        },
        [firebaseUser, token, router]
    );

    const logout = useCallback(() => {
        signOut(auth);
        setUser(null);
        setToken(null);
        setFirebaseUser(null);
        setNeedsRole(false);
        router.push("/login");
    }, [router]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                firebaseUser,
                isAuthenticated: !!user && !!token,
                loading,
                needsRole,
                register,
                login,
                loginWithGoogle,
                resetPassword,
                setupRole,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

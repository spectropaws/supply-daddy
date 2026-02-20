"use client";
import React from "react";
import type { Role } from "../page";

interface Props {
    role: Role;
    onRoleChange: (role: Role) => void;
}

const roles: { key: Role; label: string; icon: string }[] = [
    { key: "manufacturer", label: "Manufacturer", icon: "🏭" },
    { key: "transit", label: "Transit Node", icon: "🚚" },
    { key: "receiver", label: "Receiver", icon: "📦" },
];

export default function RoleSwitcher({ role, onRoleChange }: Props) {
    return (
        <div
            style={{
                display: "flex",
                gap: "4px",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-sm)",
                padding: "4px",
                border: "1px solid var(--border-color)",
            }}
        >
            {roles.map((r) => (
                <button
                    key={r.key}
                    id={`role-${r.key}`}
                    onClick={() => onRoleChange(r.key)}
                    style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: role === r.key ? 600 : 400,
                        color: role === r.key ? "white" : "var(--text-muted)",
                        background:
                            role === r.key ? "var(--gradient-primary)" : "transparent",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    <span>{r.icon}</span>
                    {r.label}
                </button>
            ))}
        </div>
    );
}

"use client";
import React from "react";
import type { Role } from "../page";
import { Button } from "./ui/button";

interface Props {
    role: Role;
    onRoleChange: (role: Role) => void;
}

const roles: { key: Role; label: string; icon: string }[] = [
    { key: "manufacturer", label: "Manufacturer", icon: "🏭" },
    { key: "transit_node", label: "Transit Node", icon: "🚚" },
    { key: "receiver", label: "Receiver", icon: "📦" },
];

export default function RoleSwitcher({ role, onRoleChange }: Props) {
    return (
        <div className="flex gap-1 bg-card rounded-lg p-1 border border-border">
            {roles.map((r) => (
                <Button
                    key={r.key}
                    id={`role-${r.key}`}
                    variant={role === r.key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onRoleChange(r.key)}
                    className={
                        role === r.key
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                            : "text-muted-foreground"
                    }
                >
                    <span>{r.icon}</span>
                    {r.label}
                </Button>
            ))}
        </div>
    );
}

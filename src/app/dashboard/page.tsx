"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    isAuthenticated,
    removeToken,
    getDashboard,
    saveApiKey,
    setBudget,
    reactivateAccount,
} from "@/lib/api";

interface DashboardData {
    currentCost: number;
    dailyLimit: number;
    percentageUsed: number;
    status: string;
    lastChecked: string | null;
    hasApiKey: boolean;
    recentAlerts: { type: string; triggered_at: string }[];
    usageHistory: { date: string; cost: number }[];
}

export default function DashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    // API Key form
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [apiKeyMsg, setApiKeyMsg] = useState("");
    const [apiKeyLoading, setApiKeyLoading] = useState(false);

    // Budget form
    const [budgetInput, setBudgetInput] = useState("");
    const [budgetMsg, setBudgetMsg] = useState("");
    const [budgetLoading, setBudgetLoading] = useState(false);

    // Reactivate
    const [reactivateLoading, setReactivateLoading] = useState(false);

    const fetchDashboard = useCallback(async () => {
        try {
            const result = await getDashboard();
            if (result.error) {
                console.error(result.error);
            } else {
                setData(result);
            }
        } catch (err) {
            console.error("Dashboard fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.replace("/login");
            return;
        }
        fetchDashboard();
    }, [router, fetchDashboard]);

    const handleSaveApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiKeyMsg("");
        setApiKeyLoading(true);
        try {
            const result = await saveApiKey(apiKeyInput);
            setApiKeyMsg(result.error || result.message);
            if (!result.error) {
                setApiKeyInput("");
                fetchDashboard();
            }
        } catch {
            setApiKeyMsg("Failed to save API key.");
        } finally {
            setApiKeyLoading(false);
        }
    };

    const handleSetBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        setBudgetMsg("");
        setBudgetLoading(true);
        try {
            const result = await setBudget(parseFloat(budgetInput));
            setBudgetMsg(result.error || result.message);
            if (!result.error) {
                setBudgetInput("");
                fetchDashboard();
            }
        } catch {
            setBudgetMsg("Failed to update budget.");
        } finally {
            setBudgetLoading(false);
        }
    };

    const handleReactivate = async () => {
        setReactivateLoading(true);
        try {
            await reactivateAccount();
            fetchDashboard();
        } catch {
            console.error("Reactivation failed.");
        } finally {
            setReactivateLoading(false);
        }
    };

    const handleLogout = () => {
        removeToken();
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-blue)", borderTopColor: "transparent" }} />
                    <p style={{ color: "var(--text-secondary)" }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const percentColor = (data?.percentageUsed ?? 0) >= 90
        ? "var(--accent-red)"
        : (data?.percentageUsed ?? 0) >= 70
            ? "var(--accent-amber)"
            : "var(--accent-green)";

    const statusColor = data?.status === "active" ? "var(--accent-green)" : "var(--accent-red)";

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
            {/* Header */}
            <header className="glass sticky top-0 z-50" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <span className="text-lg font-bold gradient-text">API Sentinel</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                        style={{ color: "var(--text-secondary)", background: "var(--bg-card)" }}
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Status banner */}
                {data?.status === "paused" && (
                    <div className="mb-6 px-6 py-4 rounded-xl flex items-center justify-between" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="font-semibold text-sm" style={{ color: "var(--accent-red)" }}>Account Paused</p>
                                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Your daily budget limit was exceeded. Reactivate to resume monitoring.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleReactivate}
                            disabled={reactivateLoading}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer"
                            style={{ background: "var(--accent-blue)" }}
                        >
                            {reactivateLoading ? "Reactivating..." : "Reactivate"}
                        </button>
                    </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Current Cost */}
                    <div className="glass rounded-xl p-5">
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Today&apos;s Usage</p>
                        <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                            ${(data?.currentCost ?? 0).toFixed(4)}
                        </p>
                    </div>

                    {/* Daily Limit */}
                    <div className="glass rounded-xl p-5">
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Daily Limit</p>
                        <p className="text-2xl font-bold" style={{ color: "var(--accent-blue)" }}>
                            ${(data?.dailyLimit ?? 0).toFixed(2)}
                        </p>
                    </div>

                    {/* Percentage Used */}
                    <div className="glass rounded-xl p-5">
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Budget Used</p>
                        <p className="text-2xl font-bold" style={{ color: percentColor }}>
                            {(data?.percentageUsed ?? 0).toFixed(1)}%
                        </p>
                        <div className="mt-3 w-full h-2 rounded-full" style={{ background: "var(--bg-primary)" }}>
                            <div
                                className="h-full rounded-full progress-animate transition-all"
                                style={{ width: `${Math.min(data?.percentageUsed ?? 0, 100)}%`, background: percentColor }}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="glass rounded-xl p-5">
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor }} />
                            <p className="text-2xl font-bold capitalize" style={{ color: statusColor }}>
                                {data?.status ?? "—"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Usage history chart */}
                {data?.usageHistory && data.usageHistory.length > 0 && (
                    <div className="glass rounded-xl p-6 mb-8">
                        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>7-Day Usage History</h3>
                        <div className="flex items-end gap-2 h-32">
                            {data.usageHistory.map((entry, i) => {
                                const maxCost = Math.max(...data.usageHistory.map((e) => e.cost), 0.01);
                                const height = (entry.cost / maxCost) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>${entry.cost.toFixed(2)}</span>
                                        <div
                                            className="w-full rounded-t-md transition-all"
                                            style={{
                                                height: `${Math.max(height, 4)}%`,
                                                background: "linear-gradient(to top, var(--accent-blue), var(--accent-purple))",
                                                minHeight: "4px",
                                            }}
                                        />
                                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                            {new Date(entry.date).toLocaleDateString("en-US", { weekday: "short" })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Configuration cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* API Key */}
                    <div className="glass rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}>
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                            </svg>
                            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>OpenAI API Key</h3>
                        </div>

                        {data?.hasApiKey && (
                            <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: "rgba(34,197,94,0.1)", color: "var(--accent-green)" }}>
                                <span>✓</span> API key is saved and encrypted
                            </div>
                        )}

                        <form onSubmit={handleSaveApiKey} className="space-y-3">
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder={data?.hasApiKey ? "Update your API key..." : "sk-..."}
                                required
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                                style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                onFocus={(e) => e.target.style.borderColor = "var(--accent-blue)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--border-color)"}
                            />
                            <button
                                type="submit"
                                disabled={apiKeyLoading}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
                                style={{ background: apiKeyLoading ? "var(--text-muted)" : "var(--accent-blue)" }}
                            >
                                {apiKeyLoading ? "Saving..." : data?.hasApiKey ? "Update Key" : "Save Key"}
                            </button>
                        </form>
                        {apiKeyMsg && (
                            <p className="mt-2 text-xs" style={{ color: apiKeyMsg.includes("error") || apiKeyMsg.includes("Failed") ? "var(--accent-red)" : "var(--accent-green)" }}>
                                {apiKeyMsg}
                            </p>
                        )}
                    </div>

                    {/* Budget */}
                    <div className="glass rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-green)" }}>
                                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Daily Budget</h3>
                        </div>

                        {(data?.dailyLimit ?? 0) > 0 && (
                            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(59,130,246,0.1)", color: "var(--accent-blue)" }}>
                                Current limit: <strong>${(data?.dailyLimit ?? 0).toFixed(2)}</strong> / day
                            </div>
                        )}

                        <form onSubmit={handleSetBudget} className="space-y-3">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={budgetInput}
                                    onChange={(e) => setBudgetInput(e.target.value)}
                                    placeholder="e.g. 5.00"
                                    required
                                    className="w-full pl-8 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                    onFocus={(e) => e.target.style.borderColor = "var(--accent-green)"}
                                    onBlur={(e) => e.target.style.borderColor = "var(--border-color)"}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={budgetLoading}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
                                style={{ background: budgetLoading ? "var(--text-muted)" : "var(--accent-green)" }}
                            >
                                {budgetLoading ? "Updating..." : "Set Daily Limit"}
                            </button>
                        </form>
                        {budgetMsg && (
                            <p className="mt-2 text-xs" style={{ color: budgetMsg.includes("error") || budgetMsg.includes("Failed") ? "var(--accent-red)" : "var(--accent-green)" }}>
                                {budgetMsg}
                            </p>
                        )}
                    </div>
                </div>

                {/* Recent Alerts */}
                {data?.recentAlerts && data.recentAlerts.length > 0 && (
                    <div className="glass rounded-xl p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Recent Alerts</h3>
                        <div className="space-y-2">
                            {data.recentAlerts.map((alert, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: "var(--bg-primary)" }}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm">🚨</span>
                                        <span className="text-sm capitalize" style={{ color: "var(--text-primary)" }}>
                                            {alert.type.replace("_", " ")}
                                        </span>
                                    </div>
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                        {new Date(alert.triggered_at).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Last checked */}
                {data?.lastChecked && (
                    <p className="text-center text-xs mt-8" style={{ color: "var(--text-muted)" }}>
                        Last checked: {new Date(data.lastChecked).toLocaleString()}
                    </p>
                )}
            </main>
        </div>
    );
}

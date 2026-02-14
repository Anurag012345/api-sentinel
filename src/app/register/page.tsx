"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, setToken } from "@/lib/api";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const data = await register(email, password);
            if (data.error) {
                setError(data.error);
            } else {
                setToken(data.token);
                router.push("/dashboard");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
            {/* Background grid */}
            <div className="fixed inset-0 opacity-5" style={{
                backgroundImage: "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)",
                backgroundSize: "60px 60px"
            }} />

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <span className="text-2xl font-bold gradient-text">API Sentinel</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)" }}>Create your free account</p>
                </div>

                {/* Form card */}
                <div className="glass rounded-2xl p-8 pulse-glow">
                    <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Create Account</h2>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                                style={{
                                    background: "var(--bg-primary)",
                                    border: "1px solid var(--border-color)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--border-color)"}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Min. 6 characters"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                                style={{
                                    background: "var(--bg-primary)",
                                    border: "1px solid var(--border-color)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--border-color)"}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repeat your password"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                                style={{
                                    background: "var(--bg-primary)",
                                    border: "1px solid var(--border-color)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--border-color)"}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 cursor-pointer"
                            style={{
                                background: loading ? "var(--text-muted)" : "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? "Creating account..." : "Create Account"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        Already have an account?{" "}
                        <Link href="/login" className="font-medium transition-colors" style={{ color: "var(--accent-purple)" }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

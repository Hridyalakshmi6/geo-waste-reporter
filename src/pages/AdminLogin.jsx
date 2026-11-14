
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function AdminLogin() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(event) {
        event.preventDefault();

        if (loading) return;

        setLoading(true);
        setError("");

        try {
            const { data, error: loginError } =
                await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });

            if (loginError) throw loginError;

            if (!data.user) {
                throw new Error("Unable to verify administrator account.");
            }

            navigate("/admin/dashboard", { replace: true });
        } catch (error) {
            console.error("Admin login failed:", error);
            setError(error.message || "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-green-50 px-5 py-12">
            <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
                <div className="text-center">
                    <div className="text-5xl">♻️</div>

                    <h1 className="mt-4 text-3xl font-bold text-gray-900">
                        Admin Login
                    </h1>

                    <p className="mt-2 text-gray-500">
                        Sign in to manage waste reports.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                    <div>
                        <label className="mb-2 block font-semibold text-gray-700">
                            Email Address
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Enter admin email"
                            required
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block font-semibold text-gray-700">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter password"
                            required
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                        />
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-green-700 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <button
                    onClick={() => navigate("/")}
                    className="mt-6 w-full text-center font-semibold text-green-700 hover:text-green-900"
                >
                    ← Back to Homepage
                </button>
            </div>
        </main>
    );
}

export default AdminLogin;

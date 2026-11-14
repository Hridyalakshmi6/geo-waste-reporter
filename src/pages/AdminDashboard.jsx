
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function AdminDashboard() {
    const navigate = useNavigate();
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState("");

    async function handleLogout() {
        if (loggingOut) return;

        setLoggingOut(true);
        setError("");

        try {
            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            navigate("/admin/login", { replace: true });
        } catch (err) {
            console.error("Logout failed:", err);
            setError("Unable to log out. Please try again.");
            setLoggingOut(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-100 p-8">
            <div className="mx-auto max-w-7xl">

                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-green-800">
                        Geo-Waste Reporter
                    </h1>

                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                        {loggingOut ? "Logging out..." : "Logout"}
                    </button>
                </div>

                {error && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                )}

                <h2 className="mt-8 text-2xl font-semibold text-gray-900">
                    Admin Dashboard
                </h2>

                <p className="mt-2 text-gray-600">
                    Welcome to the waste management administration portal.
                </p>

            </div>
        </main>
    );
}

export default AdminDashboard;

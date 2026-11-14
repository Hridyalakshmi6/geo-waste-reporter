
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function ProtectedRoute({ children }) {
    const [status, setStatus] = useState("checking");

    useEffect(() => {
        let active = true;

        async function verifyAdmin() {
            try {
                const { data: sessionData, error: sessionError } =
                    await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                const session = sessionData.session;

                if (!session) {
                    if (active) setStatus("unauthenticated");
                    return;
                }

                const { data, error } = await supabase
                    .from("admin_users")
                    .select("user_id")
                    .eq("user_id", session.user.id)
                    .maybeSingle();

                if (error) throw error;

                if (active) {
                    setStatus(data ? "authorized" : "unauthorized");
                }
            } catch (error) {
                console.error("Admin verification failed:", error);

                if (active) setStatus("error");
            }
        }

        verifyAdmin();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            verifyAdmin();
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    if (status === "checking") {
        return (
            <div className="flex min-h-screen items-center justify-center">
                Verifying administrator access...
            </div>
        );
    }

    if (status === "unauthenticated") {
        return <Navigate to="/admin/login" replace />;
    }

    if (status === "unauthorized") {
        return <Navigate to="/admin/login" replace />;
    }

    if (status === "error") {
        return (
            <div className="flex min-h-screen items-center justify-center text-red-700">
                Unable to verify administrator access. Please try again.
            </div>
        );
    }

    return children;
}

export default ProtectedRoute;

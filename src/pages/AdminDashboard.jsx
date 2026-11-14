
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const statusOptions = [
    "pending_verification",
    "verified",
    "assigned",
    "resolved",
    "rejected",
];

const statusLabels = {
    pending_verification: "Pending Verification",
    verified: "Verified",
    assigned: "Assigned",
    resolved: "Resolved",
    rejected: "Rejected",
};

function AdminDashboard() {
    const navigate = useNavigate();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const loadReports = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const { data, error: fetchError } = await supabase
                .from("reports")
                .select(
                    "id, report_code, image_path, latitude, longitude, accuracy, description, status, created_at"
                )
                .order("created_at", { ascending: false });

            if (fetchError) throw fetchError;

            const reportsWithImages = await Promise.all(
                (data || []).map(async (report) => {
                    const { data: imageData, error: imageError } =
                        await supabase.storage
                            .from("waste-images")
                            .createSignedUrl(report.image_path, 3600);

                    if (imageError) {
                        console.error(
                            "Image URL generation failed:",
                            imageError
                        );
                    }

                    return {
                        ...report,
                        imageUrl: imageData?.signedUrl || null,
                    };
                })
            );

            setReports(reportsWithImages);
        } catch (err) {
            console.error("Report loading failed:", err);
            setError(
                err.message || "Unable to load reports. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    async function handleStatusChange(reportId, newStatus) {
        setUpdatingId(reportId);
        setError("");

        try {
            const { error: updateError } = await supabase
                .from("reports")
                .update({ status: newStatus })
                .eq("id", reportId);

            if (updateError) throw updateError;

            await loadReports();
        } catch (err) {
            console.error("Status update failed:", err);
            setError(err.message || "Unable to update report status.");
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleLogout() {
        if (loggingOut) return;

        setLoggingOut(true);
        setError("");

        try {
            const { error: logoutError } =
                await supabase.auth.signOut();

            if (logoutError) throw logoutError;

            navigate("/admin/login", { replace: true });
        } catch (err) {
            console.error("Logout failed:", err);
            setError("Unable to log out. Please try again.");
            setLoggingOut(false);
        }
    }

    const totalReports = reports.length;

    const pendingReports = reports.filter(
        (report) => report.status === "pending_verification"
    ).length;

    const verifiedReports = reports.filter(
        (report) => report.status === "verified"
    ).length;

    const resolvedReports = reports.filter(
        (report) => report.status === "resolved"
    ).length;

    const statistics = [
        {
            title: "Total Reports",
            value: totalReports,
            icon: "📋",
            color: "border-blue-500",
        },
        {
            title: "Pending Verification",
            value: pendingReports,
            icon: "⏳",
            color: "border-yellow-500",
        },
        {
            title: "Verified Reports",
            value: verifiedReports,
            icon: "✅",
            color: "border-green-500",
        },
        {
            title: "Resolved Reports",
            value: resolvedReports,
            icon: "🎯",
            color: "border-purple-500",
        },
    ];

    return (
        <main className="min-h-screen bg-gray-100 px-5 py-8">
            <div className="mx-auto max-w-7xl">

                {/* HEADER */}

                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-green-800">
                            🌿 Geo-Waste Reporter
                        </h1>

                        <p className="mt-2 text-gray-500">
                            Waste Management Administration
                        </p>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                        {loggingOut ? "Logging out..." : "Logout"}
                    </button>
                </header>

                {/* PAGE TITLE */}

                <section className="mt-10">
                    <h2 className="text-3xl font-bold text-gray-900">
                        Admin Dashboard
                    </h2>

                    <p className="mt-2 text-gray-500">
                        Monitor and manage citizen waste reports.
                    </p>
                </section>

                {/* ERROR MESSAGE */}

                {error && (
                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                )}

                {/* STATISTICS */}

                <section className="mt-8">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-800">
                            Overview
                        </h3>

                        <button
                            onClick={loadReports}
                            disabled={loading}
                            className="rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
                        >
                            {loading ? "Refreshing..." : "↻ Refresh"}
                        </button>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {statistics.map((stat) => (
                            <div
                                key={stat.title}
                                className={`rounded-2xl border-l-4 ${stat.color} bg-white p-6 shadow-sm`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            {stat.title}
                                        </p>

                                        <p className="mt-3 text-3xl font-bold text-gray-900">
                                            {loading ? "—" : stat.value}
                                        </p>
                                    </div>

                                    <span className="text-3xl">
                                        {stat.icon}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* REPORTS TABLE */}

                <section className="mt-10">
                    <div className="mb-5">
                        <h3 className="text-xl font-bold text-gray-800">
                            Recent Waste Reports
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                            Citizen-submitted reports retrieved from Supabase.
                        </p>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl bg-white p-10 text-center text-gray-500">
                            Loading waste reports...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="rounded-2xl bg-white p-10 text-center text-gray-500">
                            No waste reports have been submitted yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
                            <table className="w-full min-w-[950px] text-left">
                                <thead className="bg-gray-50 text-sm text-gray-600">
                                    <tr>
                                        <th className="p-4">Photograph</th>
                                        <th className="p-4">Report ID</th>
                                        <th className="p-4">Location</th>
                                        <th className="p-4">Submitted</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {reports.map((report) => (
                                        <tr key={report.id}>
                                            <td className="p-4">
                                                {report.imageUrl ? (
                                                    <a
                                                        href={report.imageUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <img
                                                            src={report.imageUrl}
                                                            alt={`Waste report ${report.report_code}`}
                                                            className="h-20 w-24 rounded-lg object-cover"
                                                        />
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-gray-400">
                                                        Image unavailable
                                                    </span>
                                                )}
                                            </td>

                                            <td className="p-4">
                                                <p className="font-semibold text-gray-800">
                                                    {report.report_code}
                                                </p>

                                                <p className="mt-1 text-xs text-gray-400">
                                                    {report.description || "No description"}
                                                </p>
                                            </td>

                                            <td className="p-4 text-sm text-gray-600">
                                                <p>
                                                    {Number(report.latitude).toFixed(5)}
                                                </p>
                                                <p>
                                                    {Number(report.longitude).toFixed(5)}
                                                </p>
                                            </td>

                                            <td className="p-4 text-sm text-gray-600">
                                                {new Date(
                                                    report.created_at
                                                ).toLocaleString()}
                                            </td>

                                            <td className="p-4">
                                                <select
                                                    value={report.status}
                                                    disabled={updatingId === report.id}
                                                    onChange={(event) =>
                                                        handleStatusChange(
                                                            report.id,
                                                            event.target.value
                                                        )
                                                    }
                                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600 disabled:opacity-50"
                                                >
                                                    {statusOptions.map((status) => (
                                                        <option
                                                            key={status}
                                                            value={status}
                                                        >
                                                            {statusLabels[status]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </div>
        </main>
    );
}

export default AdminDashboard;

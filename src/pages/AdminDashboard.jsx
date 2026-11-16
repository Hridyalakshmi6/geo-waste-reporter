
import { normalizeHistoricalReports } from "../utils/hotspotTrends.js";
import { lazy, Suspense } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { analyzeHotspots } from "../utils/hotspotAnalysis";

const DashboardAnalytics = lazy(
    () => import("../components/DashboardAnalytics")
);

const HistoricalTrendAnalytics = lazy(
    () => import("../components/HistoricalTrendAnalytics")
);

const ReportsMap = lazy(
    () => import("../components/ReportsMap")
);

const DuplicateReportsReview = lazy(
    () => import("../components/DuplicateReportsReview")
);

const RecurringIncidentsManagement = lazy(
    () => import("../components/RecurringIncidentsManagement")
);

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


// Fetch all rows from a Supabase table in pages of 1,000.
async function fetchAllHistoricalRows(tableName, columns) {
    const PAGE_SIZE = 1000;
    let offset = 0;
    const allRows = [];

    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select(columns)
            .order("observation_date", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            throw error;
        }

        const rows = data || [];
        allRows.push(...rows);

        if (rows.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    return allRows;
}

function AdminDashboard() {
    const navigate = useNavigate();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);
    const [selectedHotspot, setSelectedHotspot] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Historical data sources
    const [publicHistoricalReports, setPublicHistoricalReports] = useState([]);
    const [syntheticHistoricalReports, setSyntheticHistoricalReports] = useState([]);

    const [historicalLoading, setHistoricalLoading] = useState(true);

    const [historicalErrors, setHistoricalErrors] = useState({
        public: "",
        synthetic: "",
    });

    // Historical analytics source filter
    const [historicalSource, setHistoricalSource] = useState("all");

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
        const timer = setTimeout(() => {
            loadReports();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadReports]);


    // Load public and synthetic historical datasets independently.
    useEffect(() => {
        let isActive = true;

        async function loadHistoricalData() {
            setHistoricalLoading(true);

            const [publicResult, syntheticResult] =
                await Promise.allSettled([
                    fetchAllHistoricalRows(
                        "public_historical_reports",
                        "id, source_record_id, observation_date, latitude, longitude"
                    ),
                    fetchAllHistoricalRows(
                        "synthetic_historical_reports",
                        "id, source_record_id, observation_date, latitude, longitude"
                    ),
                ]);

            if (!isActive) return;

            if (publicResult.status === "fulfilled") {
                setPublicHistoricalReports(publicResult.value);
            } else {
                console.error(
                    "Public historical data loading failed:",
                    publicResult.reason
                );

                setHistoricalErrors((previous) => ({
                    ...previous,
                    public: publicResult.reason?.message ||
                        "Unable to load public historical data.",
                }));
            }

            if (syntheticResult.status === "fulfilled") {
                setSyntheticHistoricalReports(syntheticResult.value);
            } else {
                console.error(
                    "Synthetic historical data loading failed:",
                    syntheticResult.reason
                );

                setHistoricalErrors((previous) => ({
                    ...previous,
                    synthetic: syntheticResult.reason?.message ||
                        "Unable to load synthetic historical data.",
                }));
            }

            setHistoricalLoading(false);
        }

        loadHistoricalData();

        return () => {
            isActive = false;
        };
    }, []);


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

    // Filter reports by Report ID and status
    // Check whether the selected date range is valid
    const invalidDateRange =
        startDate !== "" &&
        endDate !== "" &&
        startDate > endDate;

    // Filter reports by ID, status, and date range
    const filteredReports = reports.filter((report) => {
        const matchesSearch = report.report_code
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase());

        const matchesStatus =
            statusFilter === "all" ||
            report.status === statusFilter;

        const reportDate = new Date(report.created_at).getTime();

        const startDateTime = startDate
            ? new Date(`${startDate}T00:00:00`).getTime()
            : null;

        // Exclusive upper boundary includes the entire end date
        const endDateTime = endDate
            ? new Date(`${endDate}T00:00:00`).getTime() +
            24 * 60 * 60 * 1000
            : null;

        const matchesStartDate =
            startDateTime === null ||
            reportDate >= startDateTime;

        const matchesEndDate =
            endDateTime === null ||
            reportDate < endDateTime;

        return (
            !invalidDateRange &&
            matchesSearch &&
            matchesStatus &&
            matchesStartDate &&
            matchesEndDate
        );
    });

    // GeoAI hotspot analysis
    const hotspots = useMemo(
        () => analyzeHotspots(reports),
        [reports]
    );


    // Normalize citizen, public and synthetic records for historical analytics.
    const normalizedHistoricalReports = useMemo(
        () =>
            normalizeHistoricalReports({
                citizenReports: reports,
                publicReports: publicHistoricalReports,
                syntheticReports: syntheticHistoricalReports,
            }),
        [reports, publicHistoricalReports, syntheticHistoricalReports]
    );

    // Apply the selected historical source filter.
    const filteredHistoricalReports = useMemo(
        () =>
            historicalSource === "all"
                ? normalizedHistoricalReports
                : normalizedHistoricalReports.filter(
                    (report) => report.source === historicalSource
                ),
        [normalizedHistoricalReports, historicalSource]
    );

    const totalHotspots = hotspots.length;

    const highSeverityHotspots = hotspots.filter(
        (hotspot) => hotspot.severity === "High"
    ).length;

    const mediumSeverityHotspots = hotspots.filter(
        (hotspot) => hotspot.severity === "Medium"
    ).length;

    const highestHotspot = hotspots[0] || null;

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

                {historicalLoading && (
                    <p className="mt-4 text-sm text-gray-500">
                        Loading public and synthetic historical datasets...
                    </p>
                )}

                {(historicalErrors.public || historicalErrors.synthetic) && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <p className="font-semibold">
                            Some historical data could not be loaded.
                        </p>

                        {historicalErrors.public && (
                            <p className="mt-2">
                                Public dataset: {historicalErrors.public}
                            </p>
                        )}

                        {historicalErrors.synthetic && (
                            <p className="mt-2">
                                Synthetic dataset: {historicalErrors.synthetic}
                            </p>
                        )}
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

                <Suspense
                    fallback={
                        <div className="mt-10 rounded-2xl bg-white p-8 text-center text-gray-500">
                            Loading analytics...
                        </div>
                    }
                >
                    <DashboardAnalytics reports={reports} />
                </Suspense>

                <Suspense
                    fallback={
                        <div className="mt-10 rounded-2xl bg-white p-8 text-center text-gray-500">
                            Loading duplicate reports review...
                        </div>
                    }
                >
                    <DuplicateReportsReview />
                </Suspense>

                <Suspense
                    fallback={
                        <div className="mt-10 rounded-2xl bg-white p-8 text-center text-gray-500">
                            Loading recurring incident management...
                        </div>
                    }
                >
                    <RecurringIncidentsManagement />
                </Suspense>

                <Suspense
                    fallback={
                        <p className="p-4 text-gray-500">
                            Loading historical trend analytics...
                        </p>
                    }
                >
                    <HistoricalTrendAnalytics
                        reports={filteredHistoricalReports}
                        loading={historicalLoading}
                    />
                </Suspense>
                {/* GEOAI HOTSPOT ANALYTICS */}
                <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">


                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                            Historical Data Source
                        </label>

                        <select
                            value={historicalSource}
                            onChange={(event) => setHistoricalSource(event.target.value)}
                            className="w-full max-w-sm rounded-xl border border-gray-300 px-4 py-3"
                        >
                            <option value="all">All Sources</option>
                            <option value="citizen">Citizen Reports</option>
                            <option value="public">Public Dataset</option>
                            <option value="synthetic">Synthetic Dataset</option>
                        </select>
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                        {historicalLoading
                            ? "Loading historical records..."
                            : `Records loaded: ${filteredHistoricalReports.length}`}
                    </p>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            GeoAI Hotspot Analytics
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            Geographical analysis of waste report concentrations.
                        </p>
                    </div>

                    {/* HOTSPOT SUMMARY CARDS */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                        <div className="rounded-xl bg-gray-50 p-5">
                            <p className="text-sm text-gray-500">
                                Total Hotspots
                            </p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">
                                {loading ? "—" : totalHotspots}
                            </p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-5">
                            <p className="text-sm text-red-700">
                                High Severity
                            </p>
                            <p className="mt-2 text-3xl font-bold text-red-700">
                                {loading ? "—" : highSeverityHotspots}
                            </p>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-5">
                            <p className="text-sm text-amber-700">
                                Medium Severity
                            </p>
                            <p className="mt-2 text-3xl font-bold text-amber-700">
                                {loading ? "—" : mediumSeverityHotspots}
                            </p>
                        </div>

                        <div className="rounded-xl bg-blue-50 p-5">
                            <p className="text-sm text-blue-700">
                                Highest Report Count
                            </p>
                            <p className="mt-2 text-3xl font-bold text-blue-700">
                                {loading ? "—" : highestHotspot?.count ?? 0}
                            </p>
                        </div>

                    </div>

                    {/* DETECTED HOTSPOTS TABLE */}
                    <div className="mt-8">

                        <h3 className="mb-4 text-lg font-bold text-gray-800">
                            Detected Hotspot Locations
                        </h3>

                        {loading ? (
                            <p className="text-gray-500">
                                Analyzing geographical report data...
                            </p>
                        ) : hotspots.length === 0 ? (
                            <div className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                                No hotspots detected yet. At least three reports
                                must fall within the same geographical grid cell.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left">

                                    <thead className="bg-gray-50 text-sm text-gray-600">
                                        <tr>
                                            <th className="p-4">Rank</th>
                                            <th className="p-4">Hotspot ID</th>
                                            <th className="p-4">Reports</th>
                                            <th className="p-4">Severity</th>
                                            <th className="p-4">Coordinates</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">


                                        {hotspots.map((hotspot, index) => (
                                            <tr
                                                key={hotspot.id}
                                                onClick={() => setSelectedHotspot(hotspot)}
                                                className={`cursor-pointer transition-colors ${selectedHotspot?.id === hotspot.id
                                                    ? "bg-green-50"
                                                    : "hover:bg-gray-50"
                                                    }`}
                                            >
                                                <td className="p-4">{index + 1}</td>
                                                <td className="p-4 font-medium">{hotspot.id}</td>
                                                <td className="p-4">{hotspot.count}</td>
                                                <td className="p-4">{hotspot.severity}</td>
                                                <td className="p-4">
                                                    {hotspot.latitude.toFixed(5)},{" "}
                                                    {hotspot.longitude.toFixed(5)}
                                                </td>
                                            </tr>
                                        ))}


                                    </tbody>
                                </table>
                            </div>
                        )}

                    </div>

                </section>


                {/* SELECTED HOTSPOT INVESTIGATION */}
                {selectedHotspot && (
                    <section className="mb-8 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">

                        <div className="flex flex-wrap items-center justify-between gap-3">

                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    Hotspot Investigation
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Investigating hotspot {selectedHotspot.id}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedHotspot(null)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Clear Selection
                            </button>

                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-3">

                            <div className="rounded-xl bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    Total Reports
                                </p>
                                <p className="mt-2 text-2xl font-bold text-gray-900">
                                    {selectedHotspot.count}
                                </p>
                            </div>

                            <div className="rounded-xl bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    Severity
                                </p>
                                <p className={`mt-2 text-2xl font-bold ${selectedHotspot.severity === "High"
                                    ? "text-red-600"
                                    : "text-amber-600"
                                    }`}>
                                    {selectedHotspot.severity}
                                </p>
                            </div>

                            <div className="rounded-xl bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    Hotspot Coordinates
                                </p>
                                <p className="mt-2 text-sm font-semibold text-gray-900">
                                    {selectedHotspot.latitude.toFixed(5)},
                                    {" "}
                                    {selectedHotspot.longitude.toFixed(5)}
                                </p>
                            </div>

                        </div>

                        <h3 className="mb-4 mt-7 text-lg font-bold text-gray-800">
                            Reports in this Hotspot
                        </h3>

                        <div className="space-y-3">

                            {selectedHotspot.reports.map((report) => (

                                <div
                                    key={report.id}
                                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
                                >

                                    <div className="flex min-w-0 items-center gap-4">

                                        {report.imageUrl ? (
                                            <img
                                                src={report.imageUrl}
                                                alt={`Waste report ${report.report_code}`}
                                                className="h-16 w-16 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                                No image
                                            </div>
                                        )}

                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900">
                                                {report.report_code}
                                            </p>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {report.description || "No description"}
                                            </p>

                                            <p className="mt-1 text-xs capitalize text-gray-500">
                                                {report.status.replaceAll("_", " ")}
                                            </p>
                                        </div>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedReport(report)}
                                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                                    >
                                        View Details
                                    </button>

                                </div>

                            ))}

                        </div>

                    </section>
                )}

                <Suspense
                    fallback={
                        <div className="mt-10 rounded-2xl bg-white p-8 text-center text-gray-500">
                            Loading reports map...
                        </div>
                    }
                >
                    <ReportsMap
                        reports={reports}
                        selectedHotspot={selectedHotspot}
                        onViewDetails={(report) => setSelectedReport(report)}
                    />
                </Suspense>
                {/* REPORTS TABLE */}

                <section className="mt-10">
                    {/* SEARCH AND FILTER CONTROLS */}

                    <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                            {/* FILTER BY START DATE */}
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700">
                                    Start Date
                                </label>

                                <input
                                    type="date"
                                    value={startDate}
                                    max={endDate || undefined}
                                    onChange={(event) => setStartDate(event.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                                />
                            </div>

                            {/* FILTER BY END DATE */}
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700">
                                    End Date
                                </label>

                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate || undefined}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                                />
                            </div>

                            {/* SEARCH BY REPORT ID */}

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700">
                                    Search by Report ID
                                </label>

                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Enter Report ID..."
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                />
                            </div>

                            {/* FILTER BY STATUS */}

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700">
                                    Filter by Status
                                </label>

                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                                >
                                    <option value="all">All Statuses</option>

                                    {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {statusLabels[status]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        {invalidDateRange && (
                            <p className="mt-3 text-sm font-medium text-red-600">
                                End Date cannot be earlier than Start Date.
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

                            <p className="text-sm text-gray-500">
                                Showing {filteredReports.length} of {reports.length} reports
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm("");
                                    setStatusFilter("all");
                                    setStartDate("");
                                    setEndDate("");
                                }}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Clear Filters
                            </button>

                        </div>

                    </div>
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
                    ) : filteredReports.length === 0 ? (
                        <div className="rounded-2xl bg-white p-10 text-center text-gray-500">
                            No reports match your search or selected filters.
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
                                        <th className="p-4">Details</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredReports.map((report) => (
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

                                            <td className="p-4">
                                                <button
                                                    onClick={() => setSelectedReport(report)}
                                                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>

                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </div>

            {/* REPORT DETAILS MODAL */}

            {selectedReport && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold text-gray-900">
                                Report Details
                            </h2>

                            <button
                                onClick={() => setSelectedReport(null)}
                                className="rounded-lg px-3 py-2 text-xl text-gray-500 hover:bg-gray-100"
                                aria-label="Close report details"
                            >
                                ✕
                            </button>
                        </div>

                        {selectedReport.imageUrl && (
                            <img
                                src={selectedReport.imageUrl}
                                alt="Reported waste"
                                className="mt-5 max-h-72 w-full rounded-xl object-contain bg-gray-100"
                            />
                        )}

                        <div className="mt-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-500">Report ID</p>
                                <p className="font-semibold text-gray-900">
                                    {selectedReport.report_code}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">Description</p>
                                <p className="text-gray-800">
                                    {selectedReport.description || "No description provided"}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Latitude</p>
                                    <p className="font-medium">
                                        {selectedReport.latitude}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500">Longitude</p>
                                    <p className="font-medium">
                                        {selectedReport.longitude}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">GPS Accuracy</p>
                                <p className="font-medium">
                                    {selectedReport.accuracy != null
                                        ? `±${selectedReport.accuracy} metres`
                                        : "Not available"}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">Submitted At</p>
                                <p className="font-medium">
                                    {new Date(
                                        selectedReport.created_at
                                    ).toLocaleString()}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">Current Status</p>
                                <p className="font-semibold text-green-700">
                                    {statusLabels[selectedReport.status] ||
                                        selectedReport.status}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedReport(null)}
                            className="mt-7 w-full rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            )}

        </main>
    );
}

export default AdminDashboard;

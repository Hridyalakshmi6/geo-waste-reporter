
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function RecurringIncidentsManagement() {
    const [incidents, setIncidents] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [
                { data: incidentRows, error: incidentError },
                { data: candidateRows, error: candidateError },
            ] = await Promise.all([
                supabase
                    .from("recurring_incidents")
                    .select(
                        "id, incident_code, latitude, longitude, status, first_reported_at, last_reported_at, cleared_at"
                    )
                    .order("last_reported_at", { ascending: false }),

                supabase
                    .from("recurring_incident_candidates")
                    .select(
                        "id, incident_id, report_id, distance_meters, time_difference_hours, review_status, created_at"
                    )
                    .eq("review_status", "pending_review")
                    .order("created_at", { ascending: false }),
            ]);

            if (incidentError) throw incidentError;
            if (candidateError) throw candidateError;

            const incidentList = incidentRows || [];
            const candidateList = candidateRows || [];

            const incidentIds = incidentList.map(
                (incident) => incident.id
            );

            const linkedResult = incidentIds.length
                ? await supabase
                    .from("recurring_incident_reports")
                    .select("id, incident_id, report_id, linked_at")
                    .in("incident_id", incidentIds)
                : { data: [], error: null };

            if (linkedResult.error) throw linkedResult.error;

            const links = linkedResult.data || [];

            const reportIds = [
                ...new Set([
                    ...links.map((link) => link.report_id),
                    ...candidateList.map((candidate) => candidate.report_id),
                ]),
            ];

            const reportsResult = reportIds.length
                ? await supabase
                    .from("reports")
                    .select(
                        "id, report_code, image_path, latitude, longitude, description, status, created_at"
                    )
                    .in("id", reportIds)
                : { data: [], error: null };

            if (reportsResult.error) throw reportsResult.error;

            const reportsWithImages = await Promise.all(
                (reportsResult.data || []).map(async (report) => {
                    const { data: imageData, error: imageError } =
                        await supabase.storage
                            .from("waste-images")
                            .createSignedUrl(report.image_path, 3600);

                    if (imageError) {
                        console.error(
                            "Incident image loading failed:",
                            imageError
                        );
                    }

                    return {
                        ...report,
                        imageUrl: imageData?.signedUrl || null,
                    };
                })
            );

            const reportsById = new Map(
                reportsWithImages.map((report) => [
                    report.id,
                    report,
                ])
            );

            const linksByIncident = new Map();

            links.forEach((link) => {
                const report = reportsById.get(link.report_id);

                if (!report) return;

                const current = linksByIncident.get(link.incident_id) || [];

                current.push({
                    ...link,
                    report,
                });

                linksByIncident.set(link.incident_id, current);
            });

            setIncidents(
                incidentList.map((incident) => ({
                    ...incident,
                    reports: linksByIncident.get(incident.id) || [],
                }))
            );

            setCandidates(
                candidateList.map((candidate) => ({
                    ...candidate,
                    incident: incidentList.find(
                        (incident) => incident.id === candidate.incident_id
                    ) || null,
                    report: reportsById.get(candidate.report_id) || null,
                }))
            );
        } catch (err) {
            console.error("Incident management loading failed:", err);
            setError(
                err.message || "Unable to load recurring incidents."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadData]);

    async function handleCandidateReview(candidateId, reviewStatus) {
        setUpdatingId(candidateId);
        setError("");

        try {
            const { data, error: reviewError } = await supabase.rpc(
                "review_recurring_incident_candidate",
                {
                    p_candidate_id: candidateId,
                    p_review_status: reviewStatus,
                }
            );

            if (reviewError) throw reviewError;

            if (!data?.success) {
                throw new Error("The incident review was not completed.");
            }

            await loadData();
        } catch (err) {
            console.error("Incident candidate review failed:", err);
            setError(
                err.message || "Unable to review this incident candidate."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleMarkCleared(incidentId) {
        const confirmed = window.confirm(
            "Are you sure this waste site has been cleared? This will resolve the incident."
        );

        if (!confirmed) return;

        setUpdatingId(incidentId);
        setError("");

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) throw userError;
            if (!user) throw new Error("Admin session not found.");

            const { error: updateError } = await supabase
                .from("recurring_incidents")
                .update({
                    status: "resolved",
                    cleared_at: new Date().toISOString(),
                    cleared_by: user.id,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", incidentId)
                .eq("status", "open");

            if (updateError) throw updateError;

            setSelectedIncident(null);
            await loadData();
        } catch (err) {
            console.error("Incident resolution failed:", err);
            setError(
                err.message || "Unable to resolve this incident."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    const openIncidents = incidents.filter(
        (incident) => incident.status === "open"
    );

    const resolvedIncidents = incidents.filter(
        (incident) => incident.status === "resolved"
    );

    function formatDate(value) {
        return value ? new Date(value).toLocaleString() : "Not available";
    }

    function ReportCard({ report }) {
        if (!report) {
            return (
                <p className="text-sm text-red-600">
                    Report details unavailable.
                </p>
            );
        }

        return (
            <div className="rounded-xl border border-gray-200 p-4">
                {report.imageUrl ? (
                    <a
                        href={report.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <img
                            src={report.imageUrl}
                            alt={`Waste report ${report.report_code}`}
                            className="h-40 w-full rounded-lg bg-gray-100 object-cover"
                        />
                    </a>
                ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                        Image unavailable
                    </div>
                )}

                <p className="mt-3 break-all font-semibold text-gray-900">
                    {report.report_code}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                    {report.description || "No description provided"}
                </p>

                <p className="mt-2 text-xs text-gray-500">
                    {formatDate(report.created_at)}
                </p>
            </div>
        );
    }

    return (
        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Recurring Incidents Management
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                        Track repeated reports of the same physical waste
                        dumping location.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                    className="rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
                >
                    {loading ? "Refreshing..." : "↻ Refresh"}
                </button>
            </div>

            {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">Total Incidents</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                        {incidents.length}
                    </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-5">
                    <p className="text-sm text-amber-700">Open Incidents</p>
                    <p className="mt-2 text-3xl font-bold text-amber-700">
                        {openIncidents.length}
                    </p>
                </div>

                <div className="rounded-xl bg-green-50 p-5">
                    <p className="text-sm text-green-700">Resolved Incidents</p>
                    <p className="mt-2 text-3xl font-bold text-green-700">
                        {resolvedIncidents.length}
                    </p>
                </div>
            </div>

            {/* PENDING CANDIDATE REVIEW */}

            <div className="mt-9">
                <h3 className="text-xl font-bold text-gray-900">
                    Pending Incident Matches
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                    Review reports that may belong to an existing open incident.
                </p>

                {loading ? (
                    <p className="mt-5 text-gray-500">
                        Loading incident candidates...
                    </p>
                ) : candidates.length === 0 ? (
                    <div className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                        No pending incident matches.
                    </div>
                ) : (
                    <div className="mt-5 space-y-5">
                        {candidates.map((candidate) => (
                            <article
                                key={candidate.id}
                                className="rounded-xl border border-amber-200 p-5"
                            >
                                <div className="flex flex-wrap justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-gray-900">
                                            Suggested Incident Match
                                        </h4>

                                        <p className="mt-1 text-sm text-gray-500">
                                            {candidate.incident?.incident_code ||
                                                "Incident unavailable"}
                                        </p>
                                    </div>

                                    <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                        Pending Review
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div className="rounded-lg bg-gray-50 p-4">
                                        <p className="text-sm font-semibold text-gray-700">
                                            Existing Incident
                                        </p>

                                        <p className="mt-2 text-sm text-gray-600">
                                            Location:{" "}
                                            {candidate.incident
                                                ? `${Number(candidate.incident.latitude).toFixed(5)}, ${Number(candidate.incident.longitude).toFixed(5)}`
                                                : "Unavailable"}
                                        </p>

                                        <p className="mt-1 text-sm text-gray-600">
                                            Latest report:{" "}
                                            {candidate.incident
                                                ? formatDate(candidate.incident.last_reported_at)
                                                : "Unavailable"}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-gray-50 p-4">
                                        <p className="text-sm font-semibold text-gray-700">
                                            New Citizen Report
                                        </p>

                                        {candidate.report ? (
                                            <>
                                                <p className="mt-2 break-all text-sm font-medium text-gray-900">
                                                    {candidate.report.report_code}
                                                </p>

                                                <p className="mt-1 text-sm text-gray-600">
                                                    Submitted:{" "}
                                                    {formatDate(candidate.report.created_at)}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="mt-2 text-sm text-red-600">
                                                Report unavailable.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                                    <p>
                                        <strong>Distance:</strong>{" "}
                                        {Number(candidate.distance_meters).toFixed(2)} metres
                                    </p>

                                    <p>
                                        <strong>Time difference:</strong>{" "}
                                        {Number(candidate.time_difference_hours).toFixed(4)} hours
                                    </p>
                                </div>

                                {candidate.report && (
                                    <div className="mt-4 max-w-sm">
                                        <ReportCard report={candidate.report} />
                                    </div>
                                )}

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        disabled={
                                            updatingId === candidate.id ||
                                            !candidate.report ||
                                            !candidate.incident
                                        }
                                        onClick={() =>
                                            handleCandidateReview(
                                                candidate.id,
                                                "linked"
                                            )
                                        }
                                        className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                                    >
                                        {updatingId === candidate.id
                                            ? "Saving..."
                                            : "Link to Incident"}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={updatingId === candidate.id}
                                        onClick={() =>
                                            handleCandidateReview(
                                                candidate.id,
                                                "rejected"
                                            )
                                        }
                                        className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Reject Match
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {/* INCIDENT LIST */}

            <div className="mt-10">
                <h3 className="text-xl font-bold text-gray-900">
                    Incident History
                </h3>

                {loading ? (
                    <p className="mt-5 text-gray-500">
                        Loading incidents...
                    </p>
                ) : incidents.length === 0 ? (
                    <div className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                        No recurring incidents recorded yet.
                    </div>
                ) : (
                    <div className="mt-5 space-y-4">
                        {incidents.map((incident) => (
                            <article
                                key={incident.id}
                                className="rounded-xl border border-gray-200 p-5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-gray-900">
                                            {incident.incident_code}
                                        </h4>

                                        <p className="mt-1 text-sm text-gray-500">
                                            {Number(incident.latitude).toFixed(5)},{" "}
                                            {Number(incident.longitude).toFixed(5)}
                                        </p>
                                    </div>

                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${incident.status === "open"
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-green-100 text-green-800"
                                            }`}
                                    >
                                        {incident.status}
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg bg-gray-50 p-3">
                                        <p className="text-xs text-gray-500">
                                            Linked Reports
                                        </p>
                                        <p className="mt-1 text-xl font-bold">
                                            {incident.reports.length}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-gray-50 p-3">
                                        <p className="text-xs text-gray-500">
                                            First Reported
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {formatDate(incident.first_reported_at)}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-gray-50 p-3">
                                        <p className="text-xs text-gray-500">
                                            Latest Reported
                                        </p>
                                        <p className="mt-1 text-sm font-medium">
                                            {formatDate(incident.last_reported_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedIncident(
                                                selectedIncident?.id === incident.id
                                                    ? null
                                                    : incident
                                            )
                                        }
                                        className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
                                    >
                                        {selectedIncident?.id === incident.id
                                            ? "Hide Reports"
                                            : "View Incident Reports"}
                                    </button>

                                    {incident.status === "open" && (
                                        <button
                                            type="button"
                                            disabled={updatingId === incident.id}
                                            onClick={() =>
                                                handleMarkCleared(incident.id)
                                            }
                                            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                                        >
                                            {updatingId === incident.id
                                                ? "Saving..."
                                                : "Mark as Cleared"}
                                        </button>
                                    )}
                                </div>

                                {incident.status === "resolved" && (
                                    <p className="mt-3 text-sm text-green-700">
                                        Cleared: {formatDate(incident.cleared_at)}
                                    </p>
                                )}

                                {selectedIncident?.id === incident.id && (
                                    <div className="mt-5 border-t border-gray-200 pt-5">
                                        <h5 className="mb-4 font-semibold text-gray-800">
                                            Linked Citizen Reports
                                        </h5>

                                        {incident.reports.length === 0 ? (
                                            <p className="text-sm text-gray-500">
                                                No linked reports available.
                                            </p>
                                        ) : (
                                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                {incident.reports.map((link) => (
                                                    <ReportCard
                                                        key={link.id}
                                                        report={link.report}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default RecurringIncidentsManagement;

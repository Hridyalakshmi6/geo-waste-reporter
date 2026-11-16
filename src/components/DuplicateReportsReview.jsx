
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function DuplicateReportsReview() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    const loadCandidates = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const { data: candidateRows, error: candidateError } =
                await supabase
                    .from("report_duplicate_candidates")
                    .select(
                        "id, report_id, candidate_report_id, distance_meters, time_difference_hours, review_status, created_at"
                    )
                    .order("created_at", { ascending: false });

            if (candidateError) throw candidateError;

            const rows = candidateRows || [];

            if (rows.length === 0) {
                setCandidates([]);
                return;
            }

            const reportIds = [
                ...new Set(
                    rows.flatMap((candidate) => [
                        candidate.report_id,
                        candidate.candidate_report_id,
                    ])
                ),
            ];

            const { data: reportsData, error: reportsError } =
                await supabase
                    .from("reports")
                    .select(
                        "id, report_code, image_path, latitude, longitude, description, status, created_at"
                    )
                    .in("id", reportIds);

            if (reportsError) throw reportsError;

            const reportsWithImages = await Promise.all(
                (reportsData || []).map(async (report) => {
                    const { data: imageData, error: imageError } =
                        await supabase.storage
                            .from("waste-images")
                            .createSignedUrl(report.image_path, 3600);

                    if (imageError) {
                        console.error(
                            "Duplicate review image loading failed:",
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

            setCandidates(
                rows.map((candidate) => ({
                    ...candidate,
                    firstReport: reportsById.get(candidate.report_id) || null,
                    secondReport:
                        reportsById.get(candidate.candidate_report_id) || null,
                }))
            );
        } catch (err) {
            console.error("Duplicate candidates loading failed:", err);
            setError(
                err.message || "Unable to load duplicate candidates."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCandidates();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadCandidates]);

    async function handleReview(candidateId, reviewStatus) {
        setUpdatingId(candidateId);
        setError("");

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) throw userError;
            if (!user) throw new Error("Admin session not found.");

            const { error: updateError } = await supabase
                .from("report_duplicate_candidates")
                .update({
                    review_status: reviewStatus,
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", candidateId)
                .eq("review_status", "pending_review");

            if (updateError) throw updateError;

            await loadCandidates();
        } catch (err) {
            console.error("Duplicate review update failed:", err);
            setError(
                err.message || "Unable to update duplicate review."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    function formatStatus(status) {
        return status.replaceAll("_", " ");
    }

    function ReportCard({ report, title }) {
        if (!report) {
            return (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    This report could not be loaded.
                </div>
            );
        }

        return (
            <div className="min-w-0 rounded-xl border border-gray-200 p-4">
                <h4 className="mb-3 font-semibold text-gray-800">
                    {title}
                </h4>

                {report.imageUrl ? (
                    <a
                        href={report.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <img
                            src={report.imageUrl}
                            alt={`Waste report ${report.report_code}`}
                            className="h-44 w-full rounded-lg bg-gray-100 object-cover"
                        />
                    </a>
                ) : (
                    <div className="flex h-44 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                        Image unavailable
                    </div>
                )}

                <p className="mt-3 break-all font-semibold text-gray-900">
                    {report.report_code}
                </p>

                <p className="mt-2 text-sm text-gray-600">
                    {report.description || "No description provided"}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                    Location: {Number(report.latitude).toFixed(5)},{" "}
                    {Number(report.longitude).toFixed(5)}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                    Submitted: {new Date(report.created_at).toLocaleString()}
                </p>

                <p className="mt-1 text-sm capitalize text-gray-500">
                    Status: {formatStatus(report.status)}
                </p>
            </div>
        );
    }

    const pendingCount = candidates.filter(
        (candidate) => candidate.review_status === "pending_review"
    ).length;

    return (
        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Duplicate Reports Review
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                        Review reports submitted within 100 metres and 24 hours
                        of one another.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadCandidates}
                    disabled={loading}
                    className="rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
                >
                    {loading ? "Refreshing..." : "↻ Refresh"}
                </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">
                        Total Candidates
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                        {candidates.length}
                    </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-5">
                    <p className="text-sm text-amber-700">
                        Awaiting Review
                    </p>
                    <p className="mt-2 text-3xl font-bold text-amber-700">
                        {pendingCount}
                    </p>
                </div>
            </div>

            {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="mt-6 text-center text-gray-500">
                    Loading duplicate candidates...
                </p>
            ) : candidates.length === 0 ? (
                <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
                    <p className="font-semibold text-gray-700">
                        No suspected duplicates found.
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        New matching reports will appear here automatically.
                    </p>
                </div>
            ) : (
                <div className="mt-6 space-y-6">
                    {candidates.map((candidate) => (
                        <article
                            key={candidate.id}
                            className="rounded-xl border border-gray-200 p-5"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-gray-900">
                                        Possible Duplicate Pair
                                    </h3>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Detected{" "}
                                        {new Date(
                                            candidate.created_at
                                        ).toLocaleString()}
                                    </p>
                                </div>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${candidate.review_status === "pending_review"
                                        ? "bg-amber-100 text-amber-800"
                                        : candidate.review_status === "confirmed_duplicate"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-green-100 text-green-800"
                                        }`}
                                >
                                    {formatStatus(candidate.review_status)}
                                </span>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <ReportCard
                                    report={candidate.firstReport}
                                    title="New Report"
                                />

                                <ReportCard
                                    report={candidate.secondReport}
                                    title="Matching Existing Report"
                                />
                            </div>

                            <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
                                <p>
                                    <span className="font-semibold">
                                        Distance:
                                    </span>{" "}
                                    {Number(candidate.distance_meters).toFixed(2)} metres
                                </p>

                                <p>
                                    <span className="font-semibold">
                                        Time difference:
                                    </span>{" "}
                                    {Number(candidate.time_difference_hours).toFixed(4)} hours
                                </p>
                            </div>

                            {candidate.review_status === "pending_review" && (
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        disabled={updatingId === candidate.id}
                                        onClick={() =>
                                            handleReview(
                                                candidate.id,
                                                "confirmed_duplicate"
                                            )
                                        }
                                        className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {updatingId === candidate.id
                                            ? "Saving..."
                                            : "Confirm Duplicate"}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={updatingId === candidate.id}
                                        onClick={() =>
                                            handleReview(
                                                candidate.id,
                                                "not_duplicate"
                                            )
                                        }
                                        className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Not a Duplicate
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export default DuplicateReportsReview;

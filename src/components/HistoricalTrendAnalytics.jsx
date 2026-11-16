
import { useMemo, useState } from "react";
import {
    ResponsiveContainer,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    BarChart,
    Bar,
} from "recharts";

import {
    calculateActivityTrends,
    analyzeHotspotTrends,
    classifyHotspotTrends,
} from "../utils/hotspotTrends.js";

function getTrendStyle(trend) {
    switch (trend) {
        case "Increasing":
            return "bg-red-100 text-red-700";

        case "Decreasing":
            return "bg-green-100 text-green-700";

        case "Stable":
            return "bg-blue-100 text-blue-700";

        default:
            return "bg-gray-100 text-gray-700";
    }
}

function HistoricalTrendAnalytics({
    reports = [],
    loading = false,
}) {
    const [interval, setInterval] = useState("daily");

    // Daily and weekly activity.
    const activityData = useMemo(
        () => calculateActivityTrends(reports, interval),
        [reports, interval]
    );

    // Geographic hotspot analysis.
    const hotspotData = useMemo(
        () => analyzeHotspotTrends(reports),
        [reports]
    );

    // Compare the latest two complete four-week periods.
    const trendData = useMemo(
        () => classifyHotspotTrends(reports),
        [reports]
    );

    // Combine hotspot statistics and trend classifications.
    const hotspotRows = useMemo(() => {
        const trendMap = new Map(
            trendData.map((item) => [item.gridId, item])
        );

        return hotspotData.map((hotspot) => {
            const trend = trendMap.get(hotspot.gridId);

            const latitude =
                hotspot.reports.reduce(
                    (sum, report) => sum + Number(report.latitude),
                    0
                ) / hotspot.reports.length;

            const longitude =
                hotspot.reports.reduce(
                    (sum, report) => sum + Number(report.longitude),
                    0
                ) / hotspot.reports.length;

            return {
                ...hotspot,
                latitude,
                longitude,
                trend: trend?.trend || "Insufficient data",
                percentageChange: trend?.percentageChange ?? null,
                currentCount: trend?.currentCount ?? 0,
                previousCount: trend?.previousCount ?? 0,
                recurring: hotspot.activeWeeks >= 2,
            };
        });
    }, [hotspotData, trendData]);

    const totalRecords = reports.length;

    const citizenCount = reports.filter(
        (report) => report.source === "citizen"
    ).length;

    const publicCount = reports.filter(
        (report) => report.source === "public"
    ).length;

    const syntheticCount = reports.filter(
        (report) => report.source === "synthetic"
    ).length;

    const recurringHotspots = hotspotRows.filter(
        (hotspot) => hotspot.recurring
    );

    const increasingHotspots = hotspotRows.filter(
        (hotspot) => hotspot.trend === "Increasing"
    );

    if (loading) {
        return (
            <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
                <p className="text-gray-500">
                    Loading historical trend data...
                </p>
            </section>
        );
    }

    return (
        <section className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow-sm">

            {/* Heading */}
            <div>
                <h2 className="text-xl font-bold text-gray-900">
                    Historical Hotspot Trend Analysis
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Analyze historical waste-report activity over time.
                </p>
            </div>

            {/* Dataset summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">
                        Total Records
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                        {totalRecords}
                    </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-sm text-blue-700">
                        Citizen Reports
                    </p>
                    <p className="mt-2 text-2xl font-bold text-blue-800">
                        {citizenCount}
                    </p>
                </div>

                <div className="rounded-lg bg-green-50 p-4">
                    <p className="text-sm text-green-700">
                        Public Records
                    </p>
                    <p className="mt-2 text-2xl font-bold text-green-800">
                        {publicCount}
                    </p>
                </div>

                <div className="rounded-lg bg-purple-50 p-4">
                    <p className="text-sm text-purple-700">
                        Synthetic Records
                    </p>
                    <p className="mt-2 text-2xl font-bold text-purple-800">
                        {syntheticCount}
                    </p>
                </div>
            </div>

            {/* Daily / weekly selector */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    Report Activity
                </h3>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setInterval("daily")}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${interval === "daily"
                            ? "bg-green-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        Daily
                    </button>

                    <button
                        type="button"
                        onClick={() => setInterval("weekly")}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${interval === "weekly"
                            ? "bg-green-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        Weekly
                    </button>
                </div>
            </div>

            {/* Activity chart */}
            {activityData.length > 0 ? (
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={activityData}
                            margin={{
                                top: 10,
                                right: 20,
                                left: 0,
                                bottom: 10,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                            />

                            <YAxis allowDecimals={false} />

                            <Tooltip />

                            <Legend />

                            <Bar
                                dataKey="count"
                                name="Recorded Reports"
                                fill="#16a34a"
                                radius={[5, 5, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <p className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
                    No historical activity is available for this selection.
                </p>
            )}

            {/* Recurring hotspot summary */}
            <div>
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    Recurring Hotspot Overview
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-5">
                        <p className="text-sm text-orange-700">
                            Recurring Hotspots
                        </p>
                        <p className="mt-2 text-3xl font-bold text-orange-800">
                            {recurringHotspots.length}
                        </p>
                        <p className="mt-1 text-xs text-orange-700">
                            Reports recorded across at least two distinct weeks
                        </p>
                    </div>

                    <div className="rounded-lg border border-red-100 bg-red-50 p-5">
                        <p className="text-sm text-red-700">
                            Increasing Hotspots
                        </p>
                        <p className="mt-2 text-3xl font-bold text-red-800">
                            {increasingHotspots.length}
                        </p>
                        <p className="mt-1 text-xs text-red-700">
                            Based on the latest two complete four-week periods
                        </p>
                    </div>
                </div>
            </div>

            {/* Hotspot comparison table */}
            <div>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                        Hotspot Comparison and Trend Classification
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                        Geographic cells ranked by their total recorded reports.
                    </p>
                </div>

                {hotspotRows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full min-w-[950px] text-left text-sm">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3">Rank</th>
                                    <th className="px-4 py-3">Hotspot ID</th>
                                    <th className="px-4 py-3">Total Reports</th>
                                    <th className="px-4 py-3">Active Days</th>
                                    <th className="px-4 py-3">Active Weeks</th>
                                    <th className="px-4 py-3">Trend</th>
                                    <th className="px-4 py-3">Change</th>
                                    <th className="px-4 py-3">Coordinates</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {hotspotRows.slice(0, 15).map((hotspot, index) => (
                                    <tr
                                        key={hotspot.gridId}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {index + 1}
                                        </td>

                                        <td className="px-4 py-3 font-mono text-xs">
                                            {hotspot.gridId}
                                        </td>

                                        <td className="px-4 py-3 font-semibold">
                                            {hotspot.totalReports}
                                        </td>

                                        <td className="px-4 py-3">
                                            {hotspot.activeDays}
                                        </td>

                                        <td className="px-4 py-3">
                                            {hotspot.activeWeeks}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getTrendStyle(
                                                    hotspot.trend
                                                )}`}
                                            >
                                                {hotspot.trend}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            {hotspot.percentageChange === null
                                                ? "N/A"
                                                : `${hotspot.percentageChange > 0 ? "+" : ""}${hotspot.percentageChange.toFixed(1)}%`}
                                        </td>

                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {hotspot.latitude.toFixed(5)},{" "}
                                            {hotspot.longitude.toFixed(5)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
                        No hotspot locations are available for this dataset.
                    </p>
                )}

                {hotspotRows.length > 15 && (
                    <p className="mt-2 text-xs text-gray-500">
                        Showing the top 15 of {hotspotRows.length} geographic cells.
                    </p>
                )}
            </div>

            {/* Interpretation */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h4 className="font-semibold text-amber-900">
                    Data interpretation and methodology
                </h4>

                <p className="mt-1 text-sm text-amber-800">
                    These results represent recorded observations and reports,
                    not confirmed dumping events. Recurring hotspots are
                    geographic grid cells with observations in at least two
                    distinct weeks. Trend classification compares the latest
                    two complete four-week periods and requires at least three
                    active weeks in each period. Synthetic records are simulated
                    and must not be interpreted as real incidents. Missing
                    observation dates do not mean zero waste activity.
                </p>
            </div>
        </section>
    );
}

export default HistoricalTrendAnalytics;

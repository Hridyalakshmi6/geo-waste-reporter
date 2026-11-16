
import { getGridCellId } from "./hotspotAnalysis.js";

/**
 * Normalize records from the three database sources.
 *
 * Expected source values:
 * citizen, public, synthetic
 */
export function normalizeHistoricalReports({
    citizenReports = [],
    publicReports = [],
    syntheticReports = [],
}) {
    const citizen = citizenReports.map((report) => ({
        id: report.id,
        source: "citizen",
        sourceId: report.report_code,
        date: report.created_at,
        latitude: report.latitude,
        longitude: report.longitude,
        status: report.status,
    }));

    const publicData = publicReports.map((report) => ({
        id: report.id,
        source: "public",
        sourceId: report.source_record_id,
        date: report.observation_date,
        latitude: report.latitude,
        longitude: report.longitude,
        status: null,
    }));

    const synthetic = syntheticReports.map((report) => ({
        id: report.id,
        source: "synthetic",
        sourceId: report.source_record_id,
        date: report.observation_date,
        latitude: report.latitude,
        longitude: report.longitude,
        status: null,
    }));

    return [...citizen, ...publicData, ...synthetic]
        .map((report) => {
            const date = new Date(report.date);

            return {
                ...report,
                date,
                gridId: getGridCellId(
                    report.latitude,
                    report.longitude
                ),
            };
        })
        .filter(
            (report) =>
                Number.isFinite(report.date.getTime()) &&
                report.gridId !== null
        );
}

/**
 * Return a date key in YYYY-MM-DD format.
 */
function getDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

/**
 * Get Monday as the start of a calendar week.
 */
function getWeekStart(date) {
    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    const day = result.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + difference);

    return result;
}

function getWeekKey(date) {
    return getDateKey(getWeekStart(date));
}

/**
 * Group report counts by day or week.
 */
export function calculateActivityTrends(
    reports,
    interval = "daily",
    source = "all"
) {
    const filteredReports = reports.filter((report) => {
        return source === "all" || report.source === source;
    });

    const buckets = new Map();

    filteredReports.forEach((report) => {
        const key =
            interval === "weekly"
                ? getWeekKey(report.date)
                : getDateKey(report.date);

        buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({
            date,
            count,
        }));
}

/**
 * Analyze historical activity in each geographic grid cell.
 */
export function analyzeHotspotTrends(
    reports,
    source = "all"
) {
    const filteredReports = reports.filter((report) => {
        return source === "all" || report.source === source;
    });

    const cells = new Map();

    filteredReports.forEach((report) => {
        if (!cells.has(report.gridId)) {
            cells.set(report.gridId, []);
        }

        cells.get(report.gridId).push(report);
    });

    return Array.from(cells.entries())
        .map(([gridId, cellReports]) => {
            const sorted = [...cellReports].sort(
                (a, b) => a.date - b.date
            );

            const dailyCounts = new Map();

            sorted.forEach((report) => {
                const key = getDateKey(report.date);

                dailyCounts.set(
                    key,
                    (dailyCounts.get(key) || 0) + 1
                );
            });

            const weeklyCounts = new Map();

            sorted.forEach((report) => {
                const key = getWeekKey(report.date);

                weeklyCounts.set(
                    key,
                    (weeklyCounts.get(key) || 0) + 1
                );
            });

            const dailyValues = Array.from(dailyCounts.values());
            const weeklyValues = Array.from(weeklyCounts.values());

            return {
                gridId,
                totalReports: sorted.length,
                firstObserved: sorted[0].date,
                lastObserved: sorted[sorted.length - 1].date,
                activeDays: dailyCounts.size,
                activeWeeks: weeklyCounts.size,
                dailyCounts: Object.fromEntries(dailyCounts),
                weeklyCounts: Object.fromEntries(weeklyCounts),
                averageReportsPerActiveDay:
                    dailyValues.reduce((sum, value) => sum + value, 0) /
                    Math.max(dailyValues.length, 1),
                averageReportsPerActiveWeek:
                    weeklyValues.reduce((sum, value) => sum + value, 0) /
                    Math.max(weeklyValues.length, 1),
                reports: sorted,
            };
        })
        .sort((a, b) => b.totalReports - a.totalReports);
}


/**
 * Compare observed reporting activity across two consecutive
 * four-week periods for each geographic hotspot.
 *
 * Requires at least 3 active weeks in each period.
 * Missing weeks are not automatically counted as zero.
 */
export function classifyHotspotTrends(
    reports,
    source = "all",
    referenceDate = new Date()
) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * DAY_MS;
    const PERIOD_WEEKS = 4;
    const MIN_ACTIVE_WEEKS = 3;
    const CHANGE_THRESHOLD = 0.25;

    const referenceWeekStart = getWeekStart(
        new Date(referenceDate)
    );

    // Exclude the incomplete week containing referenceDate.
    const currentPeriodEnd = referenceWeekStart;

    const currentPeriodStart = new Date(
        currentPeriodEnd.getTime() -
        PERIOD_WEEKS * WEEK_MS
    );

    const previousPeriodStart = new Date(
        currentPeriodStart.getTime() -
        PERIOD_WEEKS * WEEK_MS
    );

    const filteredReports = reports.filter((report) => {
        return source === "all" || report.source === source;
    });

    const cells = new Map();

    filteredReports.forEach((report) => {
        if (!cells.has(report.gridId)) {
            cells.set(report.gridId, []);
        }

        cells.get(report.gridId).push(report);
    });

    return Array.from(cells.entries())
        .map(([gridId, cellReports]) => {
            const currentWeeks = new Set();
            const previousWeeks = new Set();

            let currentCount = 0;
            let previousCount = 0;

            cellReports.forEach((report) => {
                const reportDate = report.date;

                if (
                    reportDate >= currentPeriodStart &&
                    reportDate < currentPeriodEnd
                ) {
                    currentCount += 1;
                    currentWeeks.add(getWeekKey(reportDate));
                } else if (
                    reportDate >= previousPeriodStart &&
                    reportDate < currentPeriodStart
                ) {
                    previousCount += 1;
                    previousWeeks.add(getWeekKey(reportDate));
                }
            });

            const currentActiveWeeks = currentWeeks.size;
            const previousActiveWeeks = previousWeeks.size;

            const hasEnoughData =
                currentActiveWeeks >= MIN_ACTIVE_WEEKS &&
                previousActiveWeeks >= MIN_ACTIVE_WEEKS;

            if (!hasEnoughData) {
                return {
                    gridId,
                    trend: "Insufficient data",
                    currentCount,
                    previousCount,
                    currentActiveWeeks,
                    previousActiveWeeks,
                    percentageChange: null,
                };
            }

            const currentRate =
                currentCount / currentActiveWeeks;

            const previousRate =
                previousCount / previousActiveWeeks;

            const percentageChange =
                previousRate === 0
                    ? null
                    : (
                        (currentRate - previousRate) /
                        previousRate
                    ) * 100;

            let trend = "Stable";

            if (percentageChange === null) {
                trend = "Insufficient data";
            } else if (percentageChange >= CHANGE_THRESHOLD * 100) {
                trend = "Increasing";
            } else if (
                percentageChange <= -CHANGE_THRESHOLD * 100
            ) {
                trend = "Decreasing";
            }

            return {
                gridId,
                trend,
                currentCount,
                previousCount,
                currentActiveWeeks,
                previousActiveWeeks,
                percentageChange,
            };
        })
        .sort((a, b) => {
            return b.currentCount - a.currentCount;
        });
}

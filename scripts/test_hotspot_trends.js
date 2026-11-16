
import assert from "node:assert/strict";

import {
    normalizeHistoricalReports,
    calculateActivityTrends,
    analyzeHotspotTrends,
    classifyHotspotTrends,
} from "../src/utils/hotspotTrends.js";

// Shared coordinates ensure all records belong to one grid cell.
const LATITUDE = 12.9700;
const LONGITUDE = 77.5900;

// Existing controlled test records
const citizenReports = [
    {
        id: "c1",
        report_code: "CIT-001",
        created_at: "2026-01-05T10:00:00+05:30",
        latitude: LATITUDE,
        longitude: LONGITUDE,
        status: "pending_verification",
    },
    {
        id: "c2",
        report_code: "CIT-002",
        created_at: "2026-01-06T11:00:00+05:30",
        latitude: LATITUDE,
        longitude: LONGITUDE,
        status: "verified",
    },
];

const publicReports = [
    {
        id: "p1",
        source_record_id: "PUB-001",
        observation_date: "2026-01-07",
        latitude: LATITUDE,
        longitude: LONGITUDE,
    },
];

const syntheticReports = [
    {
        id: "s1",
        source_record_id: "SYN-001",
        observation_date: "2026-01-08",
        latitude: LATITUDE,
        longitude: LONGITUDE,
    },
];

// Test 1: Normalization
const normalized = normalizeHistoricalReports({
    citizenReports,
    publicReports,
    syntheticReports,
});

assert.equal(normalized.length, 4);

assert.equal(
    normalized.filter((report) => report.source === "citizen").length,
    2
);

assert.equal(
    normalized.filter((report) => report.source === "public").length,
    1
);

assert.equal(
    normalized.filter((report) => report.source === "synthetic").length,
    1
);

// Test 2: Daily activity
const daily = calculateActivityTrends(
    normalized,
    "daily",
    "all"
);

assert.equal(daily.length, 4);

// Test 3: Weekly activity
const weekly = calculateActivityTrends(
    normalized,
    "weekly",
    "all"
);

assert.equal(weekly.length, 1);
assert.equal(weekly[0].count, 4);

// Test 4: Source filtering
const citizenDaily = calculateActivityTrends(
    normalized,
    "daily",
    "citizen"
);

assert.equal(citizenDaily.length, 2);

// Test 5: Hotspot recurrence
const hotspots = analyzeHotspotTrends(
    normalized,
    "all"
);

assert.equal(hotspots.length, 1);
assert.equal(hotspots[0].totalReports, 4);
assert.equal(hotspots[0].activeDays, 4);
assert.equal(hotspots[0].activeWeeks, 1);

// Helper: Generate controlled citizen reports for trend testing.
function createTrendReports(weeklyCounts) {
    const reports = [];
    let id = 1;

    weeklyCounts.forEach(({ date, count }) => {
        for (let i = 0; i < count; i++) {
            reports.push({
                id: `trend-${id}`,
                report_code: `TREND-${id}`,
                created_at: `${date}T10:00:00+05:30`,
                latitude: LATITUDE,
                longitude: LONGITUDE,
                status: "pending_verification",
            });

            id++;
        }
    });

    return normalizeHistoricalReports({
        citizenReports: reports,
    });
}

// Reference date: Monday, 2 March 2026.
// Current period: 2 February to 1 March.
// Previous period: 5 January to 1 February.
const referenceDate = new Date(
    "2026-03-02T12:00:00+05:30"
);

// Test 6: Increasing activity
const increasingReports = createTrendReports([
    { date: "2026-01-05", count: 2 },
    { date: "2026-01-12", count: 2 },
    { date: "2026-01-19", count: 2 },
    { date: "2026-02-02", count: 3 },
    { date: "2026-02-09", count: 3 },
    { date: "2026-02-16", count: 3 },
]);

const increasingResult = classifyHotspotTrends(
    increasingReports,
    "citizen",
    referenceDate
);

assert.equal(increasingResult.length, 1);
assert.equal(increasingResult[0].trend, "Increasing");
assert.equal(increasingResult[0].percentageChange, 50);

// Test 7: Decreasing activity
const decreasingReports = createTrendReports([
    { date: "2026-01-05", count: 3 },
    { date: "2026-01-12", count: 3 },
    { date: "2026-01-19", count: 3 },
    { date: "2026-02-02", count: 2 },
    { date: "2026-02-09", count: 2 },
    { date: "2026-02-16", count: 2 },
]);

const decreasingResult = classifyHotspotTrends(
    decreasingReports,
    "citizen",
    referenceDate
);

assert.equal(decreasingResult[0].trend, "Decreasing");
assert.equal(decreasingResult[0].percentageChange, -33.33333333333333);

// Test 8: Stable activity
const stableReports = createTrendReports([
    { date: "2026-01-05", count: 2 },
    { date: "2026-01-12", count: 2 },
    { date: "2026-01-19", count: 2 },
    { date: "2026-02-02", count: 2 },
    { date: "2026-02-09", count: 2 },
    { date: "2026-02-16", count: 2 },
]);

const stableResult = classifyHotspotTrends(
    stableReports,
    "citizen",
    referenceDate
);

assert.equal(stableResult[0].trend, "Stable");
assert.equal(stableResult[0].percentageChange, 0);

// Test 9: Insufficient data
const insufficientReports = createTrendReports([
    { date: "2026-01-05", count: 2 },
    { date: "2026-02-02", count: 2 },
]);

const insufficientResult = classifyHotspotTrends(
    insufficientReports,
    "citizen",
    referenceDate
);

assert.equal(
    insufficientResult[0].trend,
    "Insufficient data"
);

assert.equal(
    insufficientResult[0].percentageChange,
    null
);

// Test 10: Source-specific filtering
const sourceFilteredResult = classifyHotspotTrends(
    increasingReports,
    "public",
    referenceDate
);

assert.equal(sourceFilteredResult.length, 0);

console.log("All hotspot trend tests passed.");
console.log("Normalization: PASSED");
console.log("Daily and weekly activity: PASSED");
console.log("Hotspot recurrence: PASSED");
console.log("Increasing trend: PASSED");
console.log("Decreasing trend: PASSED");
console.log("Stable trend: PASSED");
console.log("Insufficient data: PASSED");
console.log("Source filtering: PASSED");

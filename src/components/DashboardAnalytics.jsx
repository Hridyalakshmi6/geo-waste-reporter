
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

const statusLabels = {
    pending_verification: "Pending Verification",
    verified: "Verified",
    assigned: "Assigned",
    resolved: "Resolved",
    rejected: "Rejected",
};

const statusColors = {
    pending_verification: "#EAB308",
    verified: "#16A34A",
    assigned: "#2563EB",
    resolved: "#9333EA",
    rejected: "#DC2626",
};

function DashboardAnalytics({ reports }) {
    // Prepare status distribution data
    const statusData = Object.keys(statusLabels).map((status) => ({
        name: statusLabels[status],
        value: reports.filter(
            (report) => report.status === status
        ).length,
        color: statusColors[status],
    }));

    // Prepare daily submission data
    const dailyReports = {};

    reports.forEach((report) => {
        const date = new Date(report.created_at);

        const dateLabel = date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

        dailyReports[dateLabel] =
            (dailyReports[dateLabel] || 0) + 1;
    });

    const submissionData = Object.entries(dailyReports)
        .map(([date, count]) => ({
            date,
            reports: count,
        }))
        .reverse();

    return (
        <section className="mt-10">
            <h3 className="mb-5 text-2xl font-bold text-gray-800">
                Analytics & Insights
            </h3>

            <div className="grid gap-6 lg:grid-cols-2">

                {/* REPORT STATUS DISTRIBUTION */}
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <h4 className="mb-4 text-lg font-semibold text-gray-800">
                        Report Status Distribution
                    </h4>

                    {reports.length === 0 ? (
                        <p className="py-20 text-center text-gray-500">
                            No report data available yet.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={statusData.filter(
                                        (item) => item.value > 0
                                    )}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={105}
                                    innerRadius={65}
                                    paddingAngle={3}
                                    label
                                >
                                    {statusData
                                        .filter((item) => item.value > 0)
                                        .map((entry) => (
                                            <Cell
                                                key={entry.name}
                                                fill={entry.color}
                                            />
                                        ))}
                                </Pie>

                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* REPORT SUBMISSION TRENDS */}
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <h4 className="mb-4 text-lg font-semibold text-gray-800">
                        Report Submission Trends
                    </h4>

                    {reports.length === 0 ? (
                        <p className="py-20 text-center text-gray-500">
                            No report data available yet.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={submissionData}>
                                <CartesianGrid strokeDasharray="3 3" />

                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11 }}
                                />

                                <YAxis
                                    allowDecimals={false}
                                />

                                <Tooltip />

                                <Bar
                                    dataKey="reports"
                                    name="Reports Submitted"
                                    fill="#16A34A"
                                    radius={[6, 6, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

            </div>
        </section>
    );
}

export default DashboardAnalytics;

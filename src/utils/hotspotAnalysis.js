
const GRID_SIZE_KM = 0.5;

// Approximate conversion from kilometres to degrees.
const KM_PER_DEGREE_LATITUDE = 111.32;

export function analyzeHotspots(reports) {
    const validReports = reports.filter((report) => {
        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);

        return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
        );
    });

    const cells = new Map();

    validReports.forEach((report) => {
        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);

        const latitudeStep =
            GRID_SIZE_KM / KM_PER_DEGREE_LATITUDE;

        const longitudeStep =
            GRID_SIZE_KM /
            (KM_PER_DEGREE_LATITUDE *
                Math.max(Math.abs(Math.cos(latitude * Math.PI / 180)), 0.01));

        const row = Math.floor(latitude / latitudeStep);
        const column = Math.floor(longitude / longitudeStep);

        const key = `${row}:${column}`;

        if (!cells.has(key)) {
            cells.set(key, {
                id: key,
                reports: [],
                latitudeTotal: 0,
                longitudeTotal: 0,
            });
        }

        const cell = cells.get(key);

        cell.reports.push(report);
        cell.latitudeTotal += latitude;
        cell.longitudeTotal += longitude;
    });

    return Array.from(cells.values())
        .map((cell) => {
            const count = cell.reports.length;

            let severity = "Low";

            if (count >= 5) {
                severity = "High";
            } else if (count >= 3) {
                severity = "Medium";
            }

            return {
                id: cell.id,
                count,
                severity,
                latitude: cell.latitudeTotal / count,
                longitude: cell.longitudeTotal / count,
                reports: cell.reports,
            };
        })
        .filter((cell) => cell.count >= 3)
        .sort((a, b) => b.count - a.count);
}

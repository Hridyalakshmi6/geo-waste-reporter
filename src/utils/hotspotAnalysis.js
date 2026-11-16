
const GRID_SIZE_KM = 0.5;

// Approximate conversion from kilometres to degrees.
const KM_PER_DEGREE_LATITUDE = 111.32;

/**
 * Returns the geographic grid-cell ID for a location.
 * Returns null if the coordinates are invalid.
 */
export function getGridCellId(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
    ) {
        return null;
    }

    const latitudeStep =
        GRID_SIZE_KM / KM_PER_DEGREE_LATITUDE;

    const longitudeStep =
        GRID_SIZE_KM /
        (
            KM_PER_DEGREE_LATITUDE *
            Math.max(
                Math.abs(Math.cos(lat * Math.PI / 180)),
                0.01
            )
        );

    const row = Math.floor(lat / latitudeStep);
    const column = Math.floor(lon / longitudeStep);

    return `${row}:${column}`;
}

/**
 * Groups reports into geographic hotspot cells.
 */
export function analyzeHotspots(reports) {
    const cells = new Map();

    reports.forEach((report) => {
        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);

        const cellId = getGridCellId(latitude, longitude);

        if (cellId === null) {
            return;
        }

        if (!cells.has(cellId)) {
            cells.set(cellId, {
                id: cellId,
                reports: [],
                latitudeTotal: 0,
                longitudeTotal: 0,
            });
        }

        const cell = cells.get(cellId);

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

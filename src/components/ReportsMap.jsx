
import { analyzeHotspots } from "../utils/hotspotAnalysis";
import { useEffect, useMemo, useState } from "react";
import HeatLayer from "./HeatLayer";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Circle,
    useMap,
} from "react-leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet's default marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Custom marker colors for report statuses
const statusColors = {
    pending_verification: "#EAB308",
    verified: "#16A34A",
    assigned: "#2563EB",
    resolved: "#9333EA",
    rejected: "#DC2626",
};

const hotspotColors = {
    Medium: "#F59E0B",
    High: "#DC2626",
};

// Create custom Leaflet marker icons
const createStatusIcon = (status) => {
    const color = statusColors[status] || "#6B7280";

    return L.divIcon({
        className: "custom-waste-marker",
        html: `
            <div style="
                background-color: ${color};
                width: 18px;
                height: 18px;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 1px 5px rgba(0,0,0,0.5);
            "></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
    });
};

// Automatically adjust map zoom to show all reports

function MapBounds({ reports }) {
    const map = useMap();

    useEffect(() => {
        // Recalculate the map's dimensions after rendering
        map.invalidateSize({ pan: false });

        if (reports.length === 0) return;

        const positions = reports.map((report) => [
            Number(report.latitude),
            Number(report.longitude),
        ]);

        if (positions.length === 1) {
            map.setView(positions[0], 15);
        } else {
            map.fitBounds(positions, {
                padding: [40, 40],
                maxZoom: 15,
            });
        }
    }, [map, reports]);

    return null;
}


function ReportsMap({ reports = [], selectedHotspot, onViewDetails }) {

    const [showHeat, setShowHeat] = useState(false);

    // Validate report coordinates
    const validReports = useMemo(
        () =>
            reports.filter((report) => {
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
            }),
        [reports]
    );

    const heatPoints = useMemo(
        () =>
            validReports.map((report) => [
                Number(report.latitude),
                Number(report.longitude),
                1,
            ]),
        [validReports]
    );

    const hotspots = useMemo(
        () => analyzeHotspots(validReports),
        [validReports]
    );
    // Calculate initial map center
    const center = useMemo(() => {
        if (validReports.length === 0) {
            return [20.5937, 78.9629];
        }

        const total = validReports.reduce(
            (coordinates, report) => ({
                latitude:
                    coordinates.latitude + Number(report.latitude),
                longitude:
                    coordinates.longitude + Number(report.longitude),
            }),
            { latitude: 0, longitude: 0 }
        );

        return [
            total.latitude / validReports.length,
            total.longitude / validReports.length,
        ];
    }, [validReports]);

    return (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

            {/* MAP HEADER */}
            {/* MAP HEADER */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Waste Reports Map
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Locations of submitted waste reports
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowHeat((previous) => !previous)}
                    aria-pressed={showHeat}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${showHeat
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                >
                    {showHeat ? "Hide Heatmap" : "Show Heatmap"}
                </button>
            </div>
            {/* MAP */}
            <div className="overflow-hidden rounded-xl">

                <MapContainer
                    center={center}
                    zoom={validReports.length > 0 ? 12 : 5}
                    scrollWheelZoom={true}
                    style={{ height: "450px", width: "100%" }}
                >
                    <MapBounds reports={validReports} />

                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                        url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`}
                        subdomains={["a", "b", "c", "d"]}
                        maxZoom={20}
                    />

                    {/* HEATMAP LAYER */}
                    {showHeat && (
                        <HeatLayer points={heatPoints} />
                    )}

                    {/* GEOAI HOTSPOT VISUALIZATION */}
                    {hotspots.map((hotspot) => {
                        const color = hotspotColors[hotspot.severity];

                        return (
                            <Circle
                                key={hotspot.id}
                                center={[hotspot.latitude, hotspot.longitude]}
                                radius={selectedHotspot?.id === hotspot.id ? 350 : 250}
                                pathOptions={{
                                    color: selectedHotspot?.id === hotspot.id
                                        ? "#16A34A"
                                        : color,
                                    fillColor: color,
                                    fillOpacity: selectedHotspot?.id === hotspot.id
                                        ? 0.5
                                        : 0.3,
                                    weight: selectedHotspot?.id === hotspot.id
                                        ? 4
                                        : 2,
                                }}
                            ></Circle>
                        );
                    })}

                    {/* CLUSTERED REPORT MARKERS */}
                    <MarkerClusterGroup
                        chunkedLoading
                        showCoverageOnHover={false}
                        spiderfyOnMaxZoom={true}
                        removeOutsideVisibleBounds
                    >
                        {validReports.map((report) => (
                            <Marker
                                key={report.id}
                                position={[
                                    Number(report.latitude),
                                    Number(report.longitude),
                                ]}
                                icon={createStatusIcon(report.status)}
                            >
                                <Popup>
                                    <div className="min-w-40">
                                        <p className="font-bold text-gray-900">
                                            {report.report_code}
                                        </p>

                                        <p className="mt-1 text-sm capitalize">
                                            Status:{" "}
                                            {report.status.replaceAll("_", " ")}
                                        </p>

                                        {onViewDetails && (
                                            <button
                                                type="button"
                                                onClick={() => onViewDetails(report)}
                                                className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MarkerClusterGroup>

                </MapContainer>

            </div>

            {/* MARKER LEGEND */}
            <div className="mt-5 flex flex-wrap gap-4">

                {Object.entries(statusColors).map(([status, color]) => (
                    <div
                        key={status}
                        className="flex items-center gap-2 text-sm text-gray-700"
                    >
                        <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: color }}
                        />

                        <span className="capitalize">
                            {status.replaceAll("_", " ")}
                        </span>
                    </div>
                ))}

            </div>

            <p className="mt-3 text-sm text-gray-500">
                Showing {validReports.length} report location(s).
            </p>

        </section>
    );
}

export default ReportsMap;

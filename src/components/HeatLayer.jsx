
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";
import { HeatLayer as LeafletHeatLayer } from "leaflet.heat";

function HeatLayer({ points = [] }) {
    const map = useMap();

    const options = useMemo(
        () => ({
            radius: 30,
            blur: 20,
            max: 1,
            minOpacity: 0.25,
            maxZoom: 17,
        }),
        []
    );

    useEffect(() => {
        if (!points.length) return;

        const heatLayer = new LeafletHeatLayer(
            points,
            options
        );

        heatLayer.addTo(map);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [map, points, options]);

    return null;
}

export default HeatLayer;

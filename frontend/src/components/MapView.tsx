import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { Facility } from "../types";

const SOURCE_ID = "campus-facilities";
const FILL_LAYER_ID = "facility-fill";
const OUTLINE_LAYER_ID = "facility-outline";

function colorForDensity(density: number): string {
  if (density > 80) return "#ef665e";
  if (density >= 50) return "#e9ad45";
  return "#4da985";
}

function toFeatureCollection(facilities: Facility[]): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = facilities.map((facility) => ({
    type: "Feature",
    id: facility.id,
    properties: {
      facilityId: facility.id,
      density: facility.density,
      color: colorForDensity(facility.density),
    },
    geometry: facility.geometry,
  }));
  return { type: "FeatureCollection", features };
}

interface MapViewProps {
  facilities: Facility[];
  onSelect: (facilityId: string) => void;
}

export function MapView({ facilities, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const facilitiesRef = useRef(facilities);
  onSelectRef.current = onSelect;
  facilitiesRef.current = facilities;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [-122.1697, 37.4275],
      zoom: 16,
      minZoom: 13,
      maxZoom: 19,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          "osm-raster": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm-raster-layer", type: "raster", source: "osm-raster" }],
      },
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection(facilitiesRef.current),
      });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.36 },
      });
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": ["get", "color"], "line-width": 2.5 },
      });
      map.on("click", FILL_LAYER_ID, (event) => {
        const id = event.features?.[0]?.properties?.facilityId;
        if (typeof id === "string") onSelectRef.current(id);
      });
      map.on("mouseenter", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(facilities));
  }, [facilities]);

  return <div ref={containerRef} className="map-canvas" aria-label="Interactive campus map" />;
}

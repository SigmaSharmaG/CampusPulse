import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Compass,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import { FacilityModal } from "./components/FacilityModal";
import { getFacilities } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ConnectionState, Facility, WebSocketMessage } from "./types";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
const MapView = lazy(() =>
  import("./components/MapView").then((module) => ({ default: module.MapView })),
);

const connectionLabels: Record<ConnectionState, string> = {
  connecting: "Connecting",
  connected: "Live updates",
  reconnecting: "Reconnecting",
};

function densityColor(density: number): string {
  if (density > 80) return "high";
  if (density >= 50) return "medium";
  return "low";
}

function FacilityCard({ facility, onSelect }: { facility: Facility; onSelect: (facility: Facility) => void }) {
  const level = densityColor(facility.density);
  return (
    <button className="facility-card" onClick={() => onSelect(facility)} type="button">
      <span className={`facility-marker ${level}`} />
      <span className="card-content">
        <span className="card-name">{facility.name}</span>
        <span className="card-category">{facility.category}</span>
        <span className="card-meta">
          <span><Wifi size={13} /> {facility.wifi_count} online</span>
          <span><Clock3 size={13} /> {Math.round(facility.noise_db)} dB</span>
        </span>
      </span>
      <span className={`card-density ${level}`}>{Math.round(facility.density)}%</span>
      <ArrowUpRight className="card-arrow" size={15} />
    </button>
  );
}

export default function App() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { message, state } = useWebSocket<WebSocketMessage>(WS_URL);

  useEffect(() => {
    let active = true;
    getFacilities()
      .then((items) => {
        if (active) {
          setFacilities(items);
          setLoadError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load campus facilities.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    if (message.type === "snapshot") {
      setFacilities(message.data);
      setLoadError(null);
      return;
    }
    if (message.type === "facility.updated") {
      setFacilities((current) => {
        const exists = current.some((facility) => facility.id === message.data.id);
        return exists
          ? current.map((facility) => (facility.id === message.data.id ? message.data : facility))
          : [...current, message.data];
      });
      setSelected((current) =>
        current?.id === message.data.id ? message.data : current,
      );
    }
  }, [message]);

  const visibleFacilities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return facilities
      .filter((facility) => !query || `${facility.name} ${facility.category}`.toLowerCase().includes(query))
      .sort((a, b) => b.density - a.density);
  }, [facilities, search]);

  const congestion = useMemo(() => {
    if (!facilities.length) return 0;
    return Math.round(facilities.reduce((sum, item) => sum + item.density, 0) / facilities.length);
  }, [facilities]);

  const selectFacility = useCallback((facilityId: string) => {
    const facility = facilities.find((item) => item.id === facilityId);
    if (facility) setSelected(facility);
  }, [facilities]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a aria-label="CampusPulse home" className="brand" href="/">
          <span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span>
          <span>campus<span className="brand-light">pulse</span></span>
        </a>
        <div className="topbar-center">
          <span className={`connection-dot ${state}`} />
          <span>{connectionLabels[state]}</span>
          <span className="topbar-divider" />
          <span className="campus-name"><MapPin size={14} /> Northstar Campus</span>
        </div>
        <button className="campus-select" type="button">
          <Compass size={16} />
          <span>Campus map</span>
          <span className="campus-select-dot" />
        </button>
      </header>

      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div className="eyebrow-row"><span className="eyebrow">CAMPUS OVERVIEW</span><Sparkles size={14} /></div>
            <h1>Find your<br />kind of <em>space.</em></h1>
            <p className="intro-copy">A little more in-the-know about the places around you.</p>
          </div>

          <div className="campus-status-card">
            <div className="status-card-top">
              <span className="status-icon"><Activity size={16} /></span>
              <span className="eyebrow">CAMPUS PULSE</span>
              <span className="live-tag"><span /> LIVE</span>
            </div>
            <div className="status-card-value">{congestion}<span>%</span></div>
            <div className="status-card-bottom">
              <span>Average campus density</span>
              <span className="status-trend">right now</span>
            </div>
            <div className="density-track"><span style={{ width: `${congestion}%` }} /></div>
          </div>

          <div className="facilities-heading">
            <div><h2>Spaces around you</h2><span>{facilities.length} places · busiest first</span></div>
            <span className="place-count">{String(facilities.length).padStart(2, "0")}</span>
          </div>

          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search spaces"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a space..."
              value={search}
            />
            {search && <button aria-label="Clear search" onClick={() => setSearch("")} type="button"><X size={14} /></button>}
          </label>

          {loadError && <p className="inline-error">{loadError}</p>}
          <div className="facility-list">
            {visibleFacilities.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} onSelect={setSelected} />
            ))}
            {!loadError && visibleFacilities.length === 0 && (
              <p className="empty-state">{facilities.length ? "No spaces match that search." : "Loading campus spaces…"}</p>
            )}
          </div>

          <div className="sidebar-footer">
            <span className="footer-pulse"><span /></span>
            <span>Small signals, better campus days.</span>
            <span className="footer-mark">CP</span>
          </div>
        </aside>

        <section className="map-panel" aria-label="Campus facility map">
          <Suspense fallback={<div className="map-loading">Loading campus map…</div>}>
            <MapView facilities={facilities} onSelect={selectFacility} />
          </Suspense>
          <div className="map-overlay map-title">
            <div className="map-title-icon"><MapPin size={15} /></div>
            <div><strong>Northstar Campus</strong><span>Campus spaces · live activity</span></div>
          </div>
          <div className="map-overlay map-legend">
            <span className="legend-title">CAMPUS DENSITY</span>
            <span><i className="legend-dot low" /> Quiet <small>&lt;50%</small></span>
            <span><i className="legend-dot medium" /> Moderate <small>50–80%</small></span>
            <span><i className="legend-dot high" /> Busy <small>&gt;80%</small></span>
          </div>
          <div className="map-hint"><LocateFixed size={14} /> Select a zone to see its pulse</div>
          <div className="map-attribution"><span>Map data © OpenStreetMap</span></div>
        </section>
      </div>
      {selected && <FacilityModal facility={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

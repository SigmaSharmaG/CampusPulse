import { useEffect, useState } from "react";
import { Activity, Headphones, Users, Wifi, X } from "lucide-react";
import { getFacilityHistory } from "../lib/api";
import type { DensitySample, Facility } from "../types";

interface FacilityModalProps {
  facility: Facility;
  onClose: () => void;
}

function Sparkline({ samples }: { samples: DensitySample[] }) {
  if (samples.length < 2) {
    return <div className="chart-empty">Collecting live readings…</div>;
  }

  const points = samples.map((sample, index) => {
    const x = 4 + (index / (samples.length - 1)) * 192;
    const y = 68 - (sample.density / 100) * 60;
    return `${x},${y}`;
  });
  const last = samples[samples.length - 1];
  const first = samples[0];
  const path = `M ${points.join(" L ")}`;
  const areaPath = `${path} L 196,72 L 4,72 Z`;

  return (
    <div>
      <svg className="sparkline" viewBox="0 0 200 76" role="img" aria-label="Density over the last ten readings">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#559e7f" stopOpacity=".22" />
            <stop offset="100%" stopColor="#559e7f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" />
        <path d={path} fill="none" stroke="#408a6c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        <circle cx={196} cy={68 - (last.density / 100) * 60} r="3.5" fill="#408a6c" />
      </svg>
      <div className="chart-axis">
        <span>{new Date(first.sampled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>Now</span>
      </div>
    </div>
  );
}

export function FacilityModal({ facility, onClose }: FacilityModalProps) {
  const [samples, setSamples] = useState<DensitySample[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSamples([]);
    setError(null);
    getFacilityHistory(facility.id)
      .then((history) => {
        if (active) setSamples(history);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load density history.");
      });
    return () => {
      active = false;
    };
  }, [facility.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const level = facility.density > 80 ? "Busy" : facility.density >= 50 ? "Moderate" : "Quiet";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        aria-labelledby="facility-title"
        aria-modal="true"
        className="facility-modal"
        role="dialog"
      >
        <div className="modal-top">
          <div className={`modal-icon ${facility.density > 80 ? "is-high" : facility.density >= 50 ? "is-medium" : "is-low"}`}>
            <Activity size={21} />
          </div>
          <button aria-label="Close facility details" className="icon-button modal-close" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </div>
        <p className="eyebrow">{facility.category} · CAMPUS SPACE</p>
        <h2 id="facility-title">{facility.name}</h2>
        <div className="modal-density">
          <span className="density-value">{Math.round(facility.density)}%</span>
          <span className={`level-badge ${facility.density > 80 ? "is-high" : facility.density >= 50 ? "is-medium" : "is-low"}`}>
            {level} right now
          </span>
        </div>
        <div className="chart-heading">
          <div>
            <h3>Density trend</h3>
            <p>Last 10 readings · updated every 5 sec</p>
          </div>
          <Activity size={17} />
        </div>
        {error ? <p className="inline-error">{error}</p> : <Sparkline samples={samples} />}
        <div className="modal-metrics">
          <div><Users size={16} /><span>Capacity</span><strong>{facility.capacity}</strong></div>
          <div><Wifi size={16} /><span>Active Wi-Fi</span><strong>{facility.wifi_count}</strong></div>
          <div><Headphones size={16} /><span>Noise</span><strong>{Math.round(facility.noise_db)} dB</strong></div>
        </div>
        <p className="updated-note">
          Last updated {new Date(facility.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </section>
    </div>
  );
}

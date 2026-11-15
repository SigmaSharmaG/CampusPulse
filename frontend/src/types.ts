export interface PolygonGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Facility {
  id: string;
  name: string;
  category: string;
  capacity: number;
  density: number;
  wifi_count: number;
  noise_db: number;
  updated_at: string;
  geometry: PolygonGeometry;
}

export interface DensitySample {
  density: number;
  sampled_at: string;
}

export type WebSocketMessage =
  | { type: "snapshot"; data: Facility[] }
  | { type: "facility.updated"; data: Facility }
  | { type: "ping"; data: Record<string, never> };

export type ConnectionState = "connecting" | "connected" | "reconnecting";

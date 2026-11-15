import type { DensitySample, Facility } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.error?.message ?? message;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function getFacilities(): Promise<Facility[]> {
  return request<Facility[]>("/api/facilities");
}

export function getFacilityHistory(id: string): Promise<DensitySample[]> {
  return request<DensitySample[]>(`/api/facilities/${encodeURIComponent(id)}/history`);
}

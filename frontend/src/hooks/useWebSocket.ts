import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "../types";

const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const STABLE_CONNECTION_MS = 10_000;

export function useWebSocket<T>(url: string): {
  message: T | null;
  state: ConnectionState;
} {
  const [message, setMessage] = useState<T | null>(null);
  const [state, setState] = useState<ConnectionState>("connecting");
  const attempts = useRef(0);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!active) return;
      setState(attempts.current === 0 ? "connecting" : "reconnecting");
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (!active) return;
        setState("connected");
        stableTimer = setTimeout(() => {
          attempts.current = 0;
        }, STABLE_CONNECTION_MS);
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        if (!active) return;
        try {
          setMessage(JSON.parse(event.data) as T);
        } catch {
          setState("reconnecting");
          socket?.close();
        }
      };

      socket.onerror = () => socket?.close();

      socket.onclose = () => {
        if (!active) return;
        if (stableTimer) clearTimeout(stableTimer);
        const delay = Math.min(BASE_RETRY_MS * 2 ** attempts.current, MAX_RETRY_MS);
        const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
        attempts.current += 1;
        setState("reconnecting");
        retryTimer = setTimeout(connect, jitteredDelay);
      };
    };

    connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (stableTimer) clearTimeout(stableTimer);
      socket?.close();
    };
  }, [url]);

  return { message, state };
}

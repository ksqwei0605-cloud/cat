/**
 * API service for the "饿猫" backend.
 * Auto-discovers the backend port for the running server.
 */

const DEFAULT_PORTS = [8001, 8002, 8003, 8004, 8005];
let _apiBase: string | null = null;

async function discoverBase(): Promise<string> {
  if (_apiBase) return _apiBase;
  // Try each port with a short timeout
  for (const port of DEFAULT_PORTS) {
    try {
      const url = `http://localhost:${port}`;
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 500);
      const res = await fetch(`${url}/api/health`, { signal: ctrl.signal });
      clearTimeout(id);
      if (res.ok) {
        _apiBase = url;
        console.log(`[API] Connected to backend at ${url}`);
        return url;
      }
    } catch { /* try next */ }
  }
  // Fallback
  _apiBase = `http://localhost:${DEFAULT_PORTS[0]}`;
  return _apiBase;
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = await discoverBase();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export interface StatusVideo {
  id: number;
  title: string;
  category: string;
  dish_name: string;
  summary: string;
}

export interface StatusResponse {
  total_videos: number;
  category_counts: Record<string, number>;
  food_threshold: number;
  food_count: number;
  threshold_met: boolean;
  triggered: boolean;
  videos: StatusVideo[];
}

export interface Recommendation {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  tips: string;
}

export interface RecommendationsResponse {
  recommendation: Recommendation;
  source_videos: {
    id: number;
    title: string;
    dish_name: string;
    tags: string[];
  }[];
}

export interface WarRoomMessage {
  type: string;
  session_id?: string;
  agent_role: string;
  agent_name: string;
  agent_emoji?: string;
  content: string;
  round?: number;
  phase?: string;
  summary?: string;
}

// API calls

export async function ingestVideos(): Promise<any> {
  return apiFetch("/api/ingest", { method: "POST" });
}

export async function fetchStatus(): Promise<StatusResponse> {
  return apiFetch("/api/status");
}

export async function fetchRecommendations(): Promise<RecommendationsResponse> {
  return apiFetch("/api/recommendations");
}

export async function createNewWarRoom(): Promise<{
  session_id: string;
  topic: string;
  dish_name: string;
  messages: WarRoomMessage[];
}> {
  return apiFetch("/api/war-room/new", { method: "POST" });
}

/** SSE streaming for the war room */
export function streamWarRoom(
  sessionId: string,
  onMessage: (msg: WarRoomMessage) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  // Need to construct the URL using discovered base
  (async () => {
    const base = await discoverBase();
    const eventSource = new EventSource(`${base}/api/war-room/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WarRoomMessage;
        if (data.type === "done") {
          onDone();
          eventSource.close();
          return;
        }
        onMessage(data);
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    eventSource.onerror = () => {
      onError(new Error("SSE connection failed"));
      eventSource.close();
    };
  })();

  return () => {}; // cleanup handled inside async
}

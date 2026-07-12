// API Client — SIN MOCKS, sin localhost hardcoded
// Detecta automáticamente si corre en sandbox o en Pages
const isPages = typeof window !== "undefined" && window.location.host.endsWith(".pages.dev");
const isDev = import.meta.env.DEV;

// En Pages: backend en VPS (cuando haya tunnel). Por ahora fallback a API pública.
// En dev (sandbox): apunta al backend en :8000 del VPS via proxy.
const API_BASE = isPages
  ? "https://api.26b2702b.maxbry-router-ui.pages.dev"  // Pages Functions proxy
  : "http://127.0.0.1:8000";                            // dev local

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Role": "engineer",
    ...(opts.headers as Record<string, string> || {})
  };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ====== TIPOS ======
export interface Provider {
  id: string;
  name: string;
  endpoint: string;
  priority: number;
  fallback: string;
  models: string[];
  state: "online" | "offline" | "error";
  health_check: string;
  retry: number;
  timeout_s: number;
  cost_1k: number;
}

export interface HealthMonitor {
  last_check: string;
  services: Record<string, { status: string; latency_ms: number }>;
}

export interface Watchdog {
  started: string;
  heartbeats: Array<{ ts: string; ok: boolean; memory_mb: number }>;
  auto_recoveries: number;
  status: string;
  heartbeat_count: number;
  uptime_s: number;
}

export interface CircuitBreaker {
  name: string;
  state: "closed" | "open" | "half-open";
  failures: number;
  last_failure: number;
}

export interface BridgeItem {
  name: string;
  path: string;
  version: string;
  state: string;
  size_bytes: number;
  sha: string;
  last_modified: string;
  source: string;
  meta: { download_url: string };
}

export interface BridgeRegistry {
  skills: BridgeItem[];
  docs: BridgeItem[];
  memory: BridgeItem[];
  dsl: BridgeItem[];
  contracts: BridgeItem[];
}

export interface Schema {
  type: string;
  fields: Array<{ name: string; kind: string; required: boolean }>;
}

export interface Workflow {
  id: string;
  nodes: Array<{ id: string; type: string; label: string; x: number; y: number }>;
  edges: Array<{ from: string; to: string }>;
  ts: string;
}

export interface Dashboard {
  router: string;
  version: string;
  nodos_red: number;
  rutas: number;
  nodos_interface: number;
  fichas: number;
  sondeos: Record<string, string>;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  provider: string;
  created: string;
}

export interface Fichas {
  fichas: any[];
  count: number;
}

export interface MemoryItem {
  path: string;
  content: string;
  exists: boolean;
}

// ====== API CALLS ======
export const api = {
  // auth
  health: () => http<{ status: string; nodos: number; rutas: number; fichas: number }>("/health"),
  unlock: (creds: { user: string; password: string }) =>
    http<{ ok: boolean; token: string; rol: string }>("/api/unlock", { method: "POST", body: JSON.stringify(creds) }),

  // router
  dashboard: () => http<Dashboard>("/api/dashboard"),
  red: () => http<{ nodos: any[]; count: number }>("/api/red"),
  fichas: () => http<Fichas>("/api/fichas"),

  // bridge
  bridgeHealth: () => http<any>("/api/bridge/health"),
  bridgeRegistry: () => http<BridgeRegistry>("/api/bridge/registry"),
  bridgeSkills: () => http<{ skills: BridgeItem[] }>("/api/bridge/skills"),
  bridgeDocs: () => http<{ docs: BridgeItem[] }>("/api/bridge/docs"),
  bridgeSync: () => http<any>("/api/bridge/sync", { method: "POST" }),

  // memory
  memoryRead: (path: string) => http<MemoryItem>(`/api/memory/leer?path=${encodeURIComponent(path)}`),
  memorySave: (path: string, content: string) =>
    http<{ ok: boolean; path: string; bytes: number }>("/api/memory/guardar", { method: "POST", body: JSON.stringify({ path, content }) }),

  // providers
  providers: () => http<{ providers: Provider[]; count: number }>("/api/providers"),
  enableProvider: (id: string) => http<{ ok: boolean; provider: Provider }>(`/api/providers/${id}/enable`, { method: "POST" }),
  disableProvider: (id: string) => http<{ ok: boolean; provider: Provider }>(`/api/providers/${id}/disable`, { method: "POST" }),

  // health monitor
  healthMonitor: () => http<HealthMonitor>("/api/health/monitor"),

  // watchdog
  watchdog: () => http<Watchdog>("/api/watchdog"),
  recoverySimulate: () => http<{ ok: boolean; auto_recoveries: number; ts: string }>("/api/recovery/simulate", { method: "POST" }),

  // circuit breaker
  circuitBreakers: () => http<{ breakers: Record<string, CircuitBreaker> }>("/api/circuit-breakers"),
  circuitReset: (name: string) => http<{ ok: boolean; breaker: CircuitBreaker }>(`/api/circuit-breakers/${name}/reset`, { method: "POST" }),

  // marketplace
  marketplace: () => http<{ skills: BridgeItem[]; count: number }>("/api/marketplace"),
  marketplaceInstall: (name: string) => http<{ ok: boolean; installed: string; from: string; path: string }>("/api/marketplace/install", { method: "POST", body: JSON.stringify({ name }) }),

  // builder
  builderAgent: (data: Partial<Agent>) => http<{ ok: boolean; agent_id: string; created: boolean; type: string }>("/api/builder/agent", { method: "POST", body: JSON.stringify(data) }),
  builderSkill: (data: any) => http<{ ok: boolean; skill_id: string; created: boolean; type: string }>("/api/builder/skill", { method: "POST", body: JSON.stringify(data) }),
  builderWorkflow: (data: any) => http<{ ok: boolean; workflow_id: string; created: boolean; type: string }>("/api/builder/workflow", { method: "POST", body: JSON.stringify(data) }),

  // schema builder
  schemas: () => http<{ schemas: string[] }>("/api/builder/schemas"),
  saveSchema: (type: string, body: Schema) => http<{ ok: boolean; type: string; fields: number }>(`/api/builder/schemas/${type}`, { method: "POST", body: JSON.stringify(body) }),

  // custom panels
  customPanels: () => http<{ panels: Array<{ name: string; icon: string; category: string; based_on: string; enabled: boolean }>; count: number }>("/api/custom-panels"),

  // AI
  aiDiagnose: (text: string) => http<{ ok: boolean; result: any }>("/api/ai/diagnose", { method: "POST", body: JSON.stringify({ text }) }),
  aiOptimize: (text: string) => http<{ ok: boolean; result: any }>("/api/ai/optimize", { method: "POST", body: JSON.stringify({ text }) }),

  // agent run
  agentRun: (id: string, input: string) => http<{ ok: boolean; result: any }>("/api/agent/run", { method: "POST", body: JSON.stringify({ id, input }) }),

  // workflows (filesystem persistence)
  workflows: () => http<{ workflows: Workflow[]; count: number }>("/api/workflows"),
  saveWorkflow: (wf: Workflow) => http<{ ok: boolean; id: string }>("/api/workflows", { method: "POST", body: JSON.stringify(wf) }),
};

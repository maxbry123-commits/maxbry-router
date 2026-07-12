// API Client para v6.0 — IDE Router
const isPages = typeof window !== "undefined" && window.location.host.endsWith(".pages.dev");
export const API_BASE = isPages ? "https://adoption-would-blowing-encoding.trycloudflare.com" : "http://127.0.0.1:8000";

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Role": "engineer",
    ...(opts.headers as Record<string, string> || {})
  };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json() as Promise<T>;
}

export interface Resource {
  id: string;
  name: string;
  kind: string;
  [k: string]: any;
  state?: string;
  created?: string;
  updated?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  provider: string;
  model: string;
  priority: number;
  state: string;
  entradas: Record<string, boolean>;
  salidas: Record<string, boolean>;
  recursos: string[];
  created?: string;
  updated?: string;
  [k: string]: any;
}

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
}

export interface RouterConfig {
  entradas: string[];
  salidas: string[];
  prioridades: Record<string, number>;
  orden: string[];
  fallback: Record<string, string>;
  consensus: { enabled: boolean; modelos: string[]; voting: string };
  recovery: { enabled: boolean; max_retries: number; backoff_s: number; circuit_breaker_threshold: number };
}

export const client = {
  // Resources
  resources: () => http<{ resources: Resource[]; count: number }>("/api/resources"),
  resource: (id: string) => http<Resource>(`/api/resources/${id}`),
  resourceKinds: () => http<{ kinds: Record<string, any>; count: number }>("/api/resources/kinds"),
  createResource: (r: Partial<Resource>) => http<{ ok: boolean; resource: Resource }>("/api/resources", { method: "POST", body: JSON.stringify(r) }),
  updateResource: (id: string, r: Partial<Resource>) => http<{ ok: boolean; resource: Resource }>(`/api/resources/${id}`, { method: "PUT", body: JSON.stringify(r) }),
  deleteResource: (id: string) => http<{ ok: boolean; deleted: string }>(`/api/resources/${id}`, { method: "DELETE" }),

  // Agents
  agents: () => http<{ agents: Agent[]; count: number }>("/api/v2/agents"),
  agent: (id: string) => http<Agent>(`/api/v2/agents/${id}`),
  createAgent: (a: Partial<Agent>) => http<{ ok: boolean; agent: Agent }>("/api/v2/agents", { method: "POST", body: JSON.stringify(a) }),
  updateAgent: (id: string, a: Partial<Agent>) => http<{ ok: boolean; agent: Agent }>(`/api/v2/agents/${id}`, { method: "PUT", body: JSON.stringify(a) }),
  deleteAgent: (id: string) => http<{ ok: boolean; deleted: string }>(`/api/v2/agents/${id}`, { method: "DELETE" }),

  // Catalogs
  agentInputs: () => http<{ inputs: CatalogItem[]; count: number }>("/api/agents-catalog/inputs"),
  agentOutputs: () => http<{ outputs: CatalogItem[]; count: number }>("/api/agents-catalog/outputs"),

  // Router config
  routerConfig: () => http<RouterConfig>("/api/router/config"),
  routerChat: (messages: any[], model?: string) => http<any>("/api/router/chat", { method: "POST", body: JSON.stringify({ messages, model }) }),
  routerChatTest: () => http<any>("/api/router/chat/test"),
  agentFromGithub: (url: string) => http<any>("/api/agents/from-github", { method: "POST", body: JSON.stringify({ url }) }),
  saveRouterConfig: (c: RouterConfig) => http<{ ok: boolean; config: RouterConfig }>("/api/router/config", { method: "PUT", body: JSON.stringify(c) }),

  // Live
  health: () => http<any>("/health"),
  providers: () => http<{ providers: any[]; count: number }>("/api/providers"),
  watchdog: () => http<any>("/api/watchdog"),
  circuitBreakers: () => http<{ breakers: any }>("/api/circuit-breakers"),
};

// Alias para compatibilidad
export const api = client;

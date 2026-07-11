// API client + WebSocket para MAXBRY Router
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export class RouterWS {
  ws: WebSocket | null = null;
  listeners: ((m: any) => void)[] = [];
  connected = false;
  connect() {
    try {
      this.ws = new WebSocket(BASE.replace('http', 'ws') + '/ws/router');
      this.ws.onopen = () => { this.connected = true };
      this.ws.onclose = () => { this.connected = false; setTimeout(() => this.connect(), 1500) };
      this.ws.onerror = () => { this.connected = false };
      this.ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          this.listeners.forEach(l => l(m));
        } catch {}
      };
    } catch { this.connected = false; setTimeout(() => this.connect(), 1500) }
  }
  on(l: (m: any) => void) { this.listeners.push(l); }
  send(m: any) { this.ws?.send(JSON.stringify(m)); }
}

export type StatusGlobal = Record<string, 'active' | 'online' | 'warning' | 'error' | 'offline' | string>

export interface Dashboard {
  nodos_red: number
  rutas: number
  nodos_interface: number
  fichas: number
}

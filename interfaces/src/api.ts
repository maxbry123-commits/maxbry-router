// API client + WebSocket para MAXBRY Router
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function api(path: string, opts: RequestInit = {}) {
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
  connect() {
    this.ws = new WebSocket(BASE.replace('http', 'ws') + '/ws/router');
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      this.listeners.forEach(l => l(m));
    };
    this.ws.onclose = () => setTimeout(() => this.connect(), 1000);
  }
  on(l: (m: any) => void) { this.listeners.push(l); }
  send(m: any) { this.ws?.send(JSON.stringify(m)); }
}

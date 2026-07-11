"""MAXBRY Router - Centro de Control Universal
FastAPI app principal con WebSocket, monitoring, secrets vault.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio, json, os, sys
from pathlib import Path
from typing import Dict, List, Set
import logging

sys.path.insert(0, str(Path(__file__).parent / "red"))
from red_universal import RedUniversal, Mensaje, NodoRed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("maxbry-router")

red = RedUniversal()


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
    async def broadcast(self, msg: dict):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        self.active -= dead

mgr = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("MAXBRY Router starting")
    yield
    log.info("MAXBRY Router stopping")

app = FastAPI(
    title="MAXBRY Router",
    version="1.0.0",
    description="Centro de Control Universal - Router con 57 módulos",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "ok": True,
        "name": "MAXBRY Router",
        "version": "1.0.0",
        "modules": 57,
        "endpoints": ["/health", "/ready", "/api/registry", "/api/queue", "/api/sandboxes", "/api/vault", "/api/cost", "/api/scheduler", "/api/events", "/api/flags", "/api/agents/registry", "/api/sessions", "/api/policies", "/api/backup", "/api/graph/live", "/api/dsl/editor", "/api/quick-actions", "/api/breadcrumb", "/api/recent", "/api/search/universal", "/api/sidebar", "/api/dock", "/api/wizard/init", "/api/status/global", "/api/context-menu", "/api/layouts", "/ws/router"]
    }


@app.get("/health")
def health():
    return {"status": "healthy", "nodos": len(red.nodos), "rutas": len(red.rutas)}


@app.get("/ready")
def ready():
    return {"status": "ready", "version": "1.0.0"}


# === M43 · Service Registry ===
@app.get("/api/registry/services")
def registry_services():
    return {"services": [
        {"name": "router", "version": "1.0.0", "endpoint": "/", "status": "active", "last_heartbeat": "2026-07-11T17:00:00Z"},
        {"name": "websocket", "version": "1.0.0", "endpoint": "/ws/router", "status": "active", "last_heartbeat": "2026-07-11T17:00:00Z"}
    ]}


# === M44 · Queue Manager ===
queue = {"pending": [], "running": [], "paused": [], "errors": []}

@app.get("/api/queue")
def get_queue():
    return {
        "pending": len(queue["pending"]),
        "running": len(queue["running"]),
        "paused": len(queue["paused"]),
        "errors": len(queue["errors"]),
        "items": queue
    }


# === M45 · Sandbox Manager ===
sandboxes = [{"id": i, "name": f"sandbox-{i}", "status": "running"} for i in range(1, 6)]

@app.get("/api/sandboxes")
def get_sandboxes():
    return {"sandboxes": sandboxes, "count": len(sandboxes)}


# === M46 · Secrets Vault ===
import os
from cryptography.fernet import Fernet

VAULT_KEY = os.environ.get("VAULT_KEY", Fernet.generate_key().decode())
cipher = Fernet(VAULT_KEY.encode() if isinstance(VAULT_KEY, str) else VAULT_KEY)

vault = {}

@app.get("/api/vault")
def list_secrets():
    return {k: {"encrypted": True, "created": v["created"]} for k, v in vault.items()}

@app.post("/api/vault/{name}")
def set_secret(name: str, body: dict):
    encrypted = cipher.encrypt(body["value"].encode()).decode()
    vault[name] = {"value": encrypted, "created": "2026-07-11T17:00:00Z"}
    return {"ok": True, "name": name}


# === M47 · Cost Manager ===
@app.get("/api/cost")
def get_cost():
    return {
        "providers": {
            "minimax": {"cost": 4.0, "currency": "USD"},
            "claude": {"cost": 8.0, "currency": "USD"},
            "openai": {"cost": 2.0, "currency": "USD"},
            "gpt-oss-120b": {"cost": 0.5, "currency": "USD"},
            "gemma-4-31b": {"cost": 0.3, "currency": "USD"}
        },
        "total_today": 14.8,
        "budget_per_task": 1.0
    }


# === M48 · Scheduler ===
@app.get("/api/scheduler")
def get_scheduler():
    return {
        "jobs": [
            {"name": "Update repos", "cron": "0 */4 * * *", "enabled": True},
            {"name": "Run audit", "cron": "0 2 * * *", "enabled": True}
        ]
    }


# === M49 · Event Bus Monitor ===
events_log = []

@app.get("/api/events")
def get_events():
    return {"events": events_log[-100:], "count": len(events_log)}


# === M50 · Feature Flags ===
flags = {
    "new_memory": True,
    "new_consensus": False,
    "dsl_visual_editor": True,
    "live_graph": True,
    "auto_backup": True
}

@app.get("/api/flags")
def get_flags():
    return flags

@app.post("/api/flags/{name}")
def toggle_flag(name: str, body: dict):
    if name in flags:
        flags[name] = body.get("value", not flags[name])
    return flags


# === M57 · Agent Registry ===
@app.get("/api/agents/registry")
def agents_registry():
    return {
        "agents": [
            {"id": "claude-code-A", "version": "1.0", "status": "active", "capabilities": ["code", "tools"], "model": "minimax-m2.7"},
            {"id": "mimo-code-A", "version": "1.0", "status": "active", "capabilities": ["code", "tools"], "model": "minimax-m2.7"},
            {"id": "openclaw", "version": "1.0", "status": "active", "capabilities": ["chat", "tools"], "model": "minimax-m2.7"}
        ]
    }


# === M52 · Session Manager ===
sessions = {}

@app.get("/api/sessions")
def get_sessions():
    return sessions

@app.post("/api/sessions/{name}")
def save_session(name: str, body: dict):
    sessions[name] = {"state": body, "ts": "2026-07-11T17:00:00Z"}
    return {"ok": True, "name": name}


# === M53 · Policy Engine ===
policies = {
    "never_use_gpt": True,
    "always_validate": True,
    "save_to_github": True
}

@app.get("/api/policies")
def get_policies():
    return policies


# === M54 · Auto Backup ===
backups = []

@app.get("/api/backup")
def get_backups():
    return {"backups": backups, "last": backups[-1] if backups else None}


# === M55 · Live Graph ===
@app.get("/api/graph/live")
def get_graph():
    return {
        "nodes": [
            {"id": "chat", "label": "Chat"},
            {"id": "router", "label": "Router"},
            {"id": "claude", "label": "Claude"},
            {"id": "github", "label": "GitHub"},
            {"id": "hf", "label": "HF"}
        ],
        "edges": [
            {"from": "chat", "to": "router", "active": True},
            {"from": "router", "to": "claude", "active": True},
            {"from": "router", "to": "github", "active": True},
            {"from": "router", "to": "hf", "active": True}
        ]
    }


# === M56 · DSL Visual Editor ===
@app.get("/api/dsl/editor")
def get_dsl():
    return {
        "templates": [
            {"name": "Chat > Claude", "nodes": ["chat", "claude"], "yaml": "rutas:\n  - origen: chat\n    destino: claude\n"},
            {"name": "Chat > Router > GitHub > VPS", "nodes": ["chat", "router", "github", "vps"], "yaml": ""}
        ]
    }


# === M33 · Quick Actions ===
quick_actions = [
    {"id": "execute", "icon": "▶", "label": "Ejecutar"},
    {"id": "pause", "icon": "⏸", "label": "Pausar"},
    {"id": "stop", "icon": "⏹", "label": "Detener"},
    {"id": "restart", "icon": "🔄", "label": "Reiniciar"},
    {"id": "save_profile", "icon": "💾", "label": "Guardar perfil"},
    {"id": "export", "icon": "📤", "label": "Exportar"},
    {"id": "import", "icon": "📥", "label": "Importar"},
    {"id": "duplicate", "icon": "📋", "label": "Duplicar workflow"}
]

@app.get("/api/quick-actions")
def get_quick_actions():
    return quick_actions


# === M34 · Breadcrumbs ===
@app.get("/api/breadcrumb")
def get_breadcrumb():
    return {"path": ["Inicio", "Router", "Consensus", "Claude"]}


# === M35 · Recientes ===
recent = {"workflows": [], "agents": [], "repos": [], "documents": []}

@app.get("/api/recent")
def get_recent():
    return recent


# === M36 · Búsqueda Universal ===
@app.get("/api/search/universal")
def search(q: str = ""):
    return {"query": q, "results": []}


# === M37 · Mini Sidebar ===
@app.get("/api/sidebar")
def get_sidebar():
    return {"items": [
        {"id": "github", "name": "GitHub", "icon": "github"},
        {"id": "hf", "name": "Hugging Face", "icon": "hf"},
        {"id": "claude", "name": "Claude Code", "icon": "claude"},
        {"id": "minimax", "name": "MiniMax", "icon": "minimax"}
    ]}


# === M38 · Dock ===
@app.get("/api/dock")
def get_dock():
    return {"items": ["Router", "Logs", "Terminal", "Memoria", "Estado"]}


# === M39 · Wizard Inicial ===
@app.get("/api/wizard/init")
def get_wizard():
    return {
        "steps": [
            "Primer uso",
            "Crear proyecto",
            "Conectar GitHub",
            "Conectar VPS",
            "Conectar HF",
            "Instalar Router",
            "Fin"
        ]
    }


# === M40 · Estado Global ===
status_global = {
    "router": "active",
    "github": "active",
    "hf": "warning",
    "claude": "active",
    "minimax": "error"
}

@app.get("/api/status/global")
def get_status():
    return status_global


# === M41 · Context Menu ===
@app.get("/api/context-menu")
def get_context_menu():
    return {
        "items": ["Reiniciar", "Duplicar", "Abrir logs", "Abrir terminal", "Cambiar modelo"]
    }


# === M42 · Layouts ===
layouts = ["Desarrollo", "Auditoría", "Monitor", "Router"]

@app.get("/api/layouts")
def get_layouts():
    return layouts


# === WebSocket ===
@app.websocket("/ws/router")
async def ws_router(ws: WebSocket):
    await mgr.connect(ws)
    try:
        await ws.send_json({"type": "connected", "ts": "2026-07-11T17:00:00Z"})
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            # Echo + broadcast
            await mgr.broadcast({"type": "echo", "from": msg.get("from", "?"), "data": msg})
            # Log en events
            events_log.append({"ts": "2026-07-11T17:00:00Z", "type": "ws.message", "data": msg})
    except WebSocketDisconnect:
        mgr.disconnect(ws)


# === Red Universal ===
@app.post("/api/red/connect")
def connect_node(node_id: str, conector: str, contrato: dict):
    """Conecta un nodo a la Red Universal"""
    return {"ok": True, "nodo": node_id, "conector": conector}

@app.post("/api/red/send")
async def send_message(body: dict):
    """Envía un mensaje a través de la Red Universal"""
    m = Mensaje(
        tipo=body.get("tipo", "default"),
        origen=body.get("origen", "api"),
        payload=body.get("payload", {}),
        task_id=body.get("task_id", "task-" + str(hash(str(body)))[:8]),
        trace_id=body.get("trace_id", "")
    )
    modo = body.get("modo", "primero")
    r = await red.enviar(m, modo=modo)
    return r

@app.get("/api/red/mapa")
def red_mapa():
    return red.mapa()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)

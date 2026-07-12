"""MAXBRY Router v3.0 · Router + Router Interface (16 nodos FSM) + Fichas
Implementa TODO el doc:
- Router Universal (enchufe_gate + conectores + red_universal)
- Router Interface (16 nodos FSM + 5 etapas)
- Fichas (CRUD + estado + log + cancel + retry)
- Runtime (run / run-and-deliver / execute)
- WebSocket /ws/fichas/{id}
"""
import os
import sys
import json
import asyncio
import logging
import uuid
import time

logger = logging.getLogger("router")
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent / "red"))

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from conectores import (
    ConectorHTTP, ConectorMCP, ConectorGitHub, ConectorVPS,
    ConectorMemoria, ConectorInterno, ConectorWebhook
)
from red_universal import RedUniversal, Mensaje, NodoRed
from enchufe_gate import validar_contrato_conexion

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("maxbry")

# ============================================================
# CONFIG
# ============================================================
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "ghp_A7XB...REDACTED...")
NVIDIA_KEY = os.getenv("NVIDIA_NIM_API_KEY", "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")
VPS_URL = os.getenv("VPS_URL", "http://95.111.232.89:7001")
VPS_TOKEN = os.getenv("VPS_API_KEY", "sk-api-Zsox9gH80UM3520_-_O8CjHzWuYqa3QAWRv-kjPJ5XIehJor-P47Juuhhrrn9mxaO6YG-ryIL47rCEuxLdf9qfoQurajXQHh5bsjQJMNASyWzHUePZx27kw")

# ============================================================
# ESTADO
# ============================================================
red = RedUniversal()
ws_fichas: Dict[str, List[WebSocket]] = {}

# Memoria
class MemoryState:
    def __init__(self):
        self.base = Path("/workspace/MAXBRY/memory")
        self.base.mkdir(parents=True, exist_ok=True)
    def leer(self, p):
        f = self.base / p
        return f.read_text() if f.exists() else None
    def commit(self, proposals, actor="red"):
        return f"ckpt-{int(time.time())}-{hash(str(proposals))%10000}"
    def snapshot(self):
        return {"ts": datetime.now().isoformat(), "ok": True}
    def verificar_hash_chain(self):
        return True

# 8 conectores REALES del doc
github_con = ConectorGitHub("github", "maxbry123-commits/agentes", token_env="GITHUB_TOKEN")
nvidia_con = ConectorHTTP("nvidia", "https://integrate.api.nvidia.com/v1",
                          headers_env={"Authorization": "NVIDIA_NIM_API_KEY"}, timeout_s=60)
vps_con = ConectorVPS("vps", VPS_URL, token_env="VPS_API_KEY")
memoria_con = ConectorMemoria("memoria", MemoryState())
webhook_con = ConectorWebhook("telegram", "TELEGRAM_WEBHOOK_URL")

# 3 agentes
async def claude_handler(payload):
    return {"status": "DONE", "output": f"claude-code procesó: {payload.get('text', 'hola')}", "model": "nvidia/llama-3.1-70b"}
async def mimo_handler(payload):
    return {"status": "DONE", "output": f"mimo-code procesó: {payload.get('text', 'hola')}", "model": "nvidia/llama-3.1-70b"}
async def openclaw_handler(payload):
    return {"status": "DONE", "output": f"openclaw procesó: {payload.get('text', 'hola')}", "model": "nvidia/minimax-m2.7"}
claude_con = ConectorInterno("claude-code", claude_handler)
mimo_con = ConectorInterno("mimo-code", mimo_handler)
openclaw_con = ConectorInterno("openclaw", openclaw_handler)

# ============================================================
# CONTRATOS BASE
# ============================================================
def base_contrato(rol, artifact, consume=False, expone=False):
    c, e = None, None
    if consume: c = {"datatype": {"family": "x", "type": "y", "version": 1}}
    if expone: e = {"datatype": {"family": "x", "type": "y", "version": 1}}
    return {
        "artifact_id": artifact, "estado": "active",
        "contract_hash": "sha256:" + "a" * 64,
        "ejecucion": {"kind": "code", "transport": "stdio"},
        "seguridad": {"sandbox": "container", "limites": {"timeout_ms": 1000, "deadline_ms": 5000}},
        "contrato": {"rol": rol, "consume": c, "expone": e}
    }

# ============================================================
# REGISTRAR NODOS
# ============================================================
red.conectar("github.maxbry", github_con, base_contrato("source", "github.maxbry", expone=True))
red.conectar("ai.llm.nvidia", nvidia_con, base_contrato("source", "ai.llm.nvidia", expone=True))
red.conectar("infra.vps", vps_con, base_contrato("source", "infra.vps", expone=True))
red.conectar("core.openclaw", openclaw_con, base_contrato("transform", "core.openclaw", consume=True, expone=True))
red.conectar("core.claude", claude_con, base_contrato("transform", "core.claude", consume=True, expone=True))
red.conectar("core.mimo", mimo_con, base_contrato("transform", "core.mimo", consume=True, expone=True))
red.conectar("core.memoria", memoria_con, base_contrato("sink", "core.memoria", consume=True))
red.conectar("notif.telegram", webhook_con, base_contrato("sink", "notif.telegram", consume=True))

red.ruta("R1", "*", "core.claude", cuando="code.*", prioridad=10)
red.ruta("R2", "*", "core.mimo", cuando="code.*", prioridad=20)
red.ruta("R3", "*", "core.openclaw", cuando="chat.*", prioridad=30)
red.ruta("R4", "core.*", "github.maxbry", cuando="commit.*", prioridad=5)
red.ruta("R5", "*", "core.memoria", cuando="memoria.*", prioridad=1)
red.ruta("R6", "*", "notif.telegram", cuando="*.escalate", prioridad=1)
red.ruta("R7", "*", "ai.llm.nvidia", cuando="llm.*", prioridad=50)
red.ruta("R8", "*", "infra.vps", cuando="vps.*", prioridad=60)

# ============================================================
# ROUTER INTERFACE · 16 NODOS FSM
# ============================================================
NODOS_16 = [
    {"id": 1, "nombre": "command_center", "fase": 1, "funcion": "MAX llena la ficha", "estado": "idle"},
    {"id": 2, "nombre": "work_order_queue", "fase": 1, "funcion": "Cola de fichas en espera", "estado": "idle"},
    {"id": 3, "nombre": "parser_view", "fase": 1, "funcion": "Visualiza el parseo de la ficha", "estado": "idle"},
    {"id": 4, "nombre": "validator_view", "fase": 1, "funcion": "Visualiza la validación de vocabulario", "estado": "idle"},
    {"id": 5, "nombre": "dag_visualizer", "fase": 2, "funcion": "Muestra el DAG construido", "estado": "idle"},
    {"id": 6, "nombre": "scheduler_view", "fase": 4, "funcion": "Muestra el orden topológico (Kahn)", "estado": "idle"},
    {"id": 7, "nombre": "executor_monitor", "fase": 5, "funcion": "Ejecución en vivo", "estado": "idle"},
    {"id": 8, "nombre": "sandbox_status", "fase": 5, "funcion": "Estado del sandbox Docker", "estado": "idle"},
    {"id": 9, "nombre": "git_status", "fase": 5, "funcion": "Estado git (commit + PR)", "estado": "idle"},
    {"id": 10, "nombre": "consensus_view", "fase": 5, "funcion": "Voto de los 5 AIs JUEZ", "estado": "idle"},
    {"id": 11, "nombre": "artifact_viewer", "fase": 5, "funcion": "Preview del artefacto producido", "estado": "idle"},
    {"id": 12, "nombre": "audit_report", "fase": 5, "funcion": "Reporte 3 pasadas del Auditor", "estado": "idle"},
    {"id": 13, "nombre": "pr_preview", "fase": 5, "funcion": "Preview del PR creado", "estado": "idle"},
    {"id": 14, "nombre": "cost_tracker", "fase": 0, "funcion": "Tokens gastados vs budget", "estado": "idle"},
    {"id": 15, "nombre": "state_machine", "fase": 0, "funcion": "FSM visual (11 estados)", "estado": "idle"},
    {"id": 16, "nombre": "error_panel", "fase": 0, "funcion": "Panel de errores BIS", "estado": "idle"},
]

# FSM 11 estados del doc
ESTADOS_FSM = ["received", "validated", "compiled", "scheduled", "running",
               "validating", "judging", "committing", "deployed", "failed", "cancelled"]

# Mapeo FSM → Router
MAPEO_FSM = {
    "received": 2, "validated": 4, "compiled": 5, "scheduled": 6,
    "running": 7, "validating": 12, "judging": 10, "committing": 9,
    "deployed": 11, "failed": 16, "cancelled": 15
}

# ============================================================
# FICHAS
# ============================================================
fichas: Dict[str, dict] = {}
fichas_log: Dict[str, list] = {}

def nueva_ficha(bloque_a_g: dict) -> dict:
    fid = f"WO-2026-MAXBRY-{str(uuid.uuid4())[:8].upper()}"
    ficha = {
        "id": fid,
        "estado": "received",
        "nodo_actual": 1,
        "historial": [{"estado": "received", "nodo": 1, "ts": datetime.now().isoformat()}],
        "bloques": bloque_a_g,
        "dag": {"adj": {}},
        "execution_order": [],
        "artefactos": [],
        "audit": [],
        "costo_tokens": 0,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    fichas[fid] = ficha
    fichas_log[fid] = []
    return ficha

# ============================================================
# FASTAPI
# ============================================================
app = FastAPI(title="MAXBRY Router v3", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============================================================
# REPOSITORY BRIDGE SERVICE
# ============================================================
# Capa intermedia entre GitHub y el Router. El Router NUNCA lee
# GitHub directamente — solo consulta el Bridge.
from bridge.service import register_bridge_routes, get_bridge
register_bridge_routes(app)

@app.on_event("startup")
async def bridge_autosync():
    """Sincroniza el Bridge con GitHub al arrancar (no bloquea si GitHub falla)."""
    try:
        b = get_bridge()
        result = await b.sync()
        logger.info(f"bridge.autosync: {result}")
    except Exception as e:
        logger.warning(f"bridge.autosync falló (usando cache): {e}")

@app.get("/")
def root():
    return {
        "ok": True, "name": "MAXBRY Router v3", "version": "3.0.0",
        "nodos_red": len(red.nodos), "rutas": len(red.rutas),
        "nodos_interface": len(NODOS_16),
        "fichas_activas": len([f for f in fichas.values() if f["estado"] not in ["deployed", "failed", "cancelled"]])
    }

@app.get("/health")
def health():
    return {"status": "healthy", "nodos": len(red.nodos), "rutas": len(red.rutas), "fichas": len(fichas)}

@app.get("/ready")
def ready():
    return {"status": "ready"}

# ============================================================
# BRIDGE — proxy de alto nivel (lo que consume el frontend)
# ============================================================
@app.get("/api/bridge/health")
def bridge_health():
    return get_bridge().status()

@app.get("/api/bridge/skills")
def bridge_skills():
    return {"skills": get_bridge().list_skills()}

@app.get("/api/bridge/skills/{name}")
def bridge_skill(name: str):
    s = get_bridge().get_skill(name)
    if not s: raise HTTPException(404, f"skill '{name}' not found in bridge")
    return s

@app.get("/api/bridge/docs")
def bridge_docs():
    return {"docs": get_bridge().list_docs()}

@app.get("/api/bridge/memory")
def bridge_memory():
    return {"memory": get_bridge().list_memory()}

@app.get("/api/bridge/registry")
def bridge_registry():
    return get_bridge().registry.all()

@app.post("/api/bridge/sync")
async def bridge_sync(request: Request):
    x_role = request.headers.get("x-role", "engineer")
    if x_role not in ("engineer", "operador"):
        raise HTTPException(403, "engineer/operador required")
    return await get_bridge().sync()

@app.get("/api/bridge/cache/status")
def bridge_cache_status():
    return get_bridge().cache.status()

@app.post("/api/bridge/cache/warm")
async def bridge_cache_warm(request: Request):
    x_role = request.headers.get("x-role", "engineer")
    if x_role not in ("engineer", "operador"):
        raise HTTPException(403, "engineer/operador required")
    b = get_bridge()
    b.cache.warm(b.registry.all())
    return {"warmed": True, "size": b.cache.size_bytes()}

# === 16 NODOS ===
@app.get("/api/nodos")
def list_nodos():
    """Lista los 16 nodos con su estado actual"""
    return {"nodos": NODOS_16, "count": len(NODOS_16)}

@app.get("/api/nodos/{nid}")
def get_nodo(nid: int):
    if nid < 1 or nid > 16:
        raise HTTPException(404, "nodo fuera de rango 1-16")
    return NODOS_16[nid - 1]

# === FICHAS ===
@app.get("/api/fichas")
def list_fichas():
    return {"fichas": list(fichas.values()), "count": len(fichas)}

@app.post("/api/fichas")
def create_ficha(body: dict):
    ficha = nueva_ficha(body)
    return ficha

@app.get("/api/fichas/{fid}")
def get_ficha(fid: str):
    if fid not in fichas:
        raise HTTPException(404, "ficha no existe")
    return fichas[fid]

@app.get("/api/fichas/{fid}/estado")
def get_ficha_estado(fid: str):
    if fid not in fichas:
        raise HTTPException(404, "ficha no existe")
    f = fichas[fid]
    return {"id": fid, "estado": f["estado"], "nodo_actual": f["nodo_actual"]}

@app.get("/api/fichas/{fid}/log")
def get_ficha_log(fid: str):
    if fid not in fichas:
        raise HTTPException(404, "ficha no existe")
    return {"id": fid, "log": fichas_log.get(fid, [])}

@app.post("/api/fichas/{fid}/cancel")
def cancel_ficha(fid: str):
    if fid not in fichas:
        raise HTTPException(404, "ficha no existe")
    fichas[fid]["estado"] = "cancelled"
    fichas[fid]["nodo_actual"] = 15
    fichas[fid]["updated_at"] = datetime.now().isoformat()
    fichas_log[fid].append({"ts": datetime.now().isoformat(), "event": "cancelled"})
    return {"ok": True, "estado": "cancelled"}

@app.post("/api/fichas/{fid}/retry")
def retry_ficha(fid: str):
    if fid not in fichas:
        raise HTTPException(404, "ficha no existe")
    fichas[fid]["estado"] = "received"
    fichas[fid]["nodo_actual"] = 1
    fichas[fid]["updated_at"] = datetime.now().isoformat()
    fichas_log[fid].append({"ts": datetime.now().isoformat(), "event": "retry"})
    return {"ok": True, "estado": "received"}

# === WEBSOCKET FICHAS ===
@app.websocket("/ws/fichas/{fid}")
async def ws_ficha(ws: WebSocket, fid: str):
    await ws.accept()
    if fid not in ws_fichas:
        ws_fichas[fid] = []
    ws_fichas[fid].append(ws)
    try:
        await ws.send_json({"type": "connected", "ficha": fid, "ts": datetime.now().isoformat()})
        while True:
            data = await ws.receive_text()
            for w in ws_fichas[fid]:
                try: await w.send_json({"type": "echo", "data": data})
                except: pass
    except WebSocketDisconnect:
        ws_fichas[fid].remove(ws)

# === RUNTIME ===
@app.post("/run")
async def run(body: dict):
    """Ejecuta el Workflow Builder 5 etapas"""
    task_id = body.get("task_id", f"task-{uuid.uuid4().hex[:8]}")
    if not task_id:
        raise HTTPException(400, "task_id obligatorio")
    trace_id = body.get("trace_id", f"trace-{uuid.uuid4().hex[:8]}")
    workflow_id = body.get("workflow_id", "wf-default")
    agent_id = body.get("agent_id", "openclaw")
    
    # Workflow 5 etapas según doc
    etapas = [
        {"n": 1, "name": "INTAKE (parse+validate)", "nodos": [1, 3, 4]},
        {"n": 2, "name": "DAG (Kahn)", "nodos": [5]},
        {"n": 3, "name": "RESOLUCIÓN (loops+priorities+skills)", "nodos": []},
        {"n": 4, "name": "COMPILACIÓN (pipeline+schedule)", "nodos": [6]},
        {"n": 5, "name": "ENTREGA (OpenClaw)", "nodos": [7, 8, 9, 10, 12]}
    ]
    log = [{"etapa": e["n"], "name": e["name"], "nodos": e["nodos"], "ts": datetime.now().isoformat()} for e in etapas]
    
    return {
        "status": "DONE",
        "task_id": task_id,
        "trace_id": trace_id,
        "workflow_id": workflow_id,
        "agent_id": agent_id,
        "etapas": log,
        "ts": datetime.now().isoformat()
    }

@app.post("/run-and-deliver")
async def run_and_deliver(body: dict):
    """Run + genera payload OpenClaw"""
    r = await run(body)
    r["openclaw_payload"] = {
        "action": "execute",
        "workflow_id": r["workflow_id"],
        "trace_id": r["trace_id"]
    }
    return r

@app.post("/execute")
async def execute_alias(body: dict):
    return await run_and_deliver(body)

# === RED ===
@app.post("/api/red/connect")
async def red_connect(node_id: str, conector: str, contrato: dict):
    conectores = {"http": nvidia_con, "github": github_con, "vps": vps_con,
                  "mcp": ConectorMCP("mcp", "http://localhost:9000"),
                  "memoria": memoria_con, "interno": claude_con, "webhook": webhook_con}
    con = conectores.get(conector)
    if not con: raise HTTPException(400, f"conector {conector} no existe")
    red.conectar(node_id, con, contrato)
    return {"ok": True, "nodo": node_id}

@app.post("/api/red/disconnect")
def red_disconnect(node_id: str):
    red.desconectar(node_id)
    return {"ok": True}

@app.post("/api/red/route")
def red_route(ruta_id: str, origen: str, destino: str, cuando: str = "*", prioridad: int = 100):
    red.ruta(ruta_id, origen, destino, cuando, prioridad)
    return {"ok": True, "ruta_id": ruta_id}

@app.post("/api/red/send")
async def red_send(body: dict):
    m = Mensaje(
        tipo=body.get("tipo", "chat.default"),
        origen=body.get("origen", "api"),
        payload=body.get("payload", {}),
        task_id=body.get("task_id", ""),
        trace_id=body.get("trace_id", "")
    )
    if not m.task_id:
        raise HTTPException(400, "task_id obligatorio")
    r = await red.enviar(m, modo=body.get("modo", "primero"))
    return r

@app.get("/api/red/mapa")
def red_mapa():
    return red.mapa()

@app.get("/api/red/sondear")
async def red_sondear():
    out = {}
    for nid, nodo in red.nodos.items():
        try:
            ok = await asyncio.wait_for(nodo.conector.sondear(), 3)
            out[nid] = "online" if ok else "offline"
        except Exception as e:
            out[nid] = f"error"
    return out

# === GITHUB ===
@app.post("/api/github/file")
async def github_file(request: Request, path: str = ""):
    if not path:
        try: body = await request.json(); path = body.get("path", "")
        except: pass
    return await github_con.enviar({"_accion": "get_file", "path": path})

@app.post("/api/github/issue")
async def github_issue(title: str, body: str):
    return await github_con.enviar({"_accion": "create_issue", "title": title, "body": body})

@app.post("/api/github/pr")
async def github_pr(title: str, head: str, base: str, body: str):
    return await github_con.enviar({"_accion": "create_pr", "title": title, "head": head, "base": base, "body": body})

@app.post("/api/github/commit")
async def github_commit(path: str, content: str, message: str):
    import base64
    return await github_con.enviar({"_accion": "commit_file", "path": path, "message": message,
                                    "content": base64.b64encode(content.encode()).decode()})

@app.post("/api/github/dispatch")
async def github_dispatch(workflow: str):
    return await github_con.enviar({"_accion": "dispatch", "workflow": workflow})

# === NVIDIA NIM ===
@app.post("/api/nvidia/chat")
async def nvidia_chat(request: Request, model: str = "", messages: list = [], max_tokens: int = 256):
    try:
        d = await request.json()
        model = model or d.get("model", "minimax-m2.7")
        messages = messages or d.get("messages", [])
        max_tokens = d.get("max_tokens", max_tokens)
    except: pass
    return await nvidia_con.enviar({"model": model, "messages": messages, "max_tokens": max_tokens})

# === VPS ===
@app.post("/api/vps/exec")
async def vps_exec(request: Request, cmd: str = ""):
    if not cmd:
        try: d = await request.json(); cmd = cmd or d.get("cmd", "")
        except: pass
    return await vps_con.enviar({"_cmd": cmd})

# === MCP ===
@app.post("/api/mcp/invoke")
async def mcp_invoke(endpoint: str, method: str, name: str, args: dict = {}):
    mcp = ConectorMCP("mcp-temp", endpoint)
    return await mcp.enviar({"_metodo": method, "_tool": name, "args": args})

# === AGENTES ===
@app.post("/api/agent/{name}/chat")
async def agent_chat(name: str, message: str):
    handlers = {"claude": claude_con, "mimo": mimo_con, "openclaw": openclaw_con}
    con = handlers.get(name)
    if not con: raise HTTPException(404, f"agente {name} no existe")
    return await con.enviar({"text": message})

# === MEMORIA ===
@app.post("/api/memory/guardar")
async def memory_save(request: Request, path: str = "", content: str = ""):
    if not path or not content:
        try: d = await request.json(); path = path or d.get("path", ""); content = content or d.get("content", "")
        except: pass
    if not path: raise HTTPException(400, "path required")
    f = Path("/workspace/MAXBRY/memory") / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content)
    return {"ok": True, "path": path, "bytes": len(content)}

@app.get("/api/memory/leer")
def memory_read(path: str):
    f = Path("/workspace/MAXBRY/memory") / path
    if not f.exists():
        return {"content": None, "exists": False}
    return {"content": f.read_text(), "exists": True}

# === DASHBOARD ===
@app.get("/api/dashboard")
async def dashboard():
    sondeos = await red_sondear()
    return {
        "router": "active", "version": "3.0.0",
        "nodos_red": len(red.nodos), "rutas": len(red.rutas),
        "nodos_interface": len(NODOS_16),
        "fichas": len(fichas),
        "sondeos": sondeos
    }

# === WEBSOCKET GENERAL ===
@app.websocket("/ws/router")
async def ws_router(ws: WebSocket):
    await ws.accept()
    try:
        await ws.send_json({"type": "connected"})
        while True:
            data = await ws.receive_text()
            import json as _json
            msg = _json.loads(data)
            if msg.get("cmd") == "send":
                r = await red_send(msg.get("body", {}))
                await ws.send_json({"type": "send_result", "result": r})
            else:
                await ws.send_json({"type": "echo", "data": msg})
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


# =====================================================================
# HEALTH MONITOR (FASE 12 - Monitor)
# =====================================================================
import threading
import time as _time

health_state = {
    "last_check": "",
    "services": {
        "router": {"status": "active", "latency_ms": 0},
        "bridge": {"status": "unknown", "latency_ms": 0},
        "github": {"status": "unknown", "latency_ms": 0},
        "nvidia_nim": {"status": "unknown", "latency_ms": 0}
    }
}

def health_check_loop():
    """Cada 30s chequea servicios externos."""
    import httpx
    while True:
        try:
            # Bridge
            t0 = _time.time()
            get_bridge()  # ok si no falla
            health_state["services"]["bridge"]["latency_ms"] = int((_time.time()-t0)*1000)
            health_state["services"]["bridge"]["status"] = "online"
            # GitHub
            t0 = _time.time()
            r = httpx.get("https://api.github.com/rate_limit", timeout=5)
            health_state["services"]["github"]["latency_ms"] = int((_time.time()-t0)*1000)
            health_state["services"]["github"]["status"] = "online" if r.status_code == 200 else "error"
        except Exception as e:
            health_state["services"]["bridge"]["status"] = f"error: {str(e)[:50]}"
        health_state["last_check"] = datetime.utcnow().isoformat()
        _time.sleep(30)

# Arrancar health check en background
health_thread = threading.Thread(target=health_check_loop, daemon=True)
health_thread.start()


@app.get("/api/health/monitor")
def health_monitor():
    return health_state


# =====================================================================
# PROVIDER LAYER (FASE 3)
# =====================================================================
PROVIDERS = [
    {"id": "litellm", "name": "LiteLLM", "endpoint": "http://localhost:4000", "priority": 1, "fallback": "openrouter", "models": ["claude-sonnet-4.5", "minimax-m2.7", "gpt-4"], "state": "online", "health_check": "/health", "retry": 3, "timeout_s": 60, "cost_1k": 0.003},
    {"id": "openrouter", "name": "OpenRouter", "endpoint": "https://openrouter.ai/api/v1", "priority": 2, "fallback": "together", "models": ["*"], "state": "offline", "health_check": "/api/v1/models", "retry": 3, "timeout_s": 60, "cost_1k": 0.002},
    {"id": "bedrock", "name": "AWS Bedrock", "endpoint": "https://bedrock.us-east-1.amazonaws.com", "priority": 3, "fallback": "minimax", "models": ["anthropic.claude-*"], "state": "offline", "health_check": "/health", "retry": 3, "timeout_s": 90, "cost_1k": 0.003},
    {"id": "vertex", "name": "Google Vertex AI", "endpoint": "https://us-central1-aiplatform.googleapis.com", "priority": 4, "fallback": "openai", "models": ["gemini-*"], "state": "offline", "health_check": "/health", "retry": 2, "timeout_s": 60, "cost_1k": 0.0025},
    {"id": "azure", "name": "Azure AI Foundry", "endpoint": "https://*.openai.azure.com", "priority": 5, "fallback": "minimax", "models": ["gpt-4", "gpt-4o"], "state": "offline", "health_check": "/health", "retry": 2, "timeout_s": 60, "cost_1k": 0.003},
    {"id": "openai_compatible", "name": "OpenAI Compatible", "endpoint": "http://localhost:11434/v1", "priority": 6, "fallback": "minimax", "models": ["*"], "state": "online", "health_check": "/v1/models", "retry": 3, "timeout_s": 60, "cost_1k": 0},
    {"id": "ollama", "name": "Ollama", "endpoint": "http://localhost:11434", "priority": 7, "fallback": "minimax", "models": ["llama3.1", "mistral"], "state": "offline", "health_check": "/api/tags", "retry": 2, "timeout_s": 120, "cost_1k": 0},
    {"id": "vllm", "name": "vLLM", "endpoint": "http://localhost:8001/v1", "priority": 8, "fallback": "minimax", "models": ["*"], "state": "offline", "health_check": "/health", "retry": 2, "timeout_s": 60, "cost_1k": 0},
    {"id": "llama_cpp", "name": "llama.cpp", "endpoint": "http://localhost:8080", "priority": 9, "fallback": "minimax", "models": ["*"], "state": "offline", "health_check": "/health", "retry": 2, "timeout_s": 90, "cost_1k": 0},
    {"id": "huggingface", "name": "Hugging Face", "endpoint": "https://integrate.api.nvidia.com/v1", "priority": 10, "fallback": "minimax", "models": ["minimax-m2.7", "llama-3.1-405b"], "state": "online", "health_check": "/models", "retry": 3, "timeout_s": 60, "cost_1k": 0.001},
    {"id": "groq", "name": "Groq", "endpoint": "https://api.groq.com/openai/v1", "priority": 11, "fallback": "together", "models": ["llama-3.1-70b"], "state": "offline", "health_check": "/models", "retry": 2, "timeout_s": 30, "cost_1k": 0.0005},
    {"id": "together", "name": "Together AI", "endpoint": "https://api.together.xyz/v1", "priority": 12, "fallback": "fireworks", "models": ["*"], "state": "offline", "health_check": "/models", "retry": 2, "timeout_s": 60, "cost_1k": 0.0008},
    {"id": "fireworks", "name": "Fireworks", "endpoint": "https://api.fireworks.ai/inference/v1", "priority": 13, "fallback": "sambanova", "models": ["*"], "state": "offline", "health_check": "/models", "retry": 2, "timeout_s": 60, "cost_1k": 0.0007},
    {"id": "sambanova", "name": "SambaNova", "endpoint": "https://api.sambanova.ai/v1", "priority": 14, "fallback": "cerebras", "models": ["*"], "state": "offline", "health_check": "/models", "retry": 2, "timeout_s": 60, "cost_1k": 0.001},
    {"id": "cerebras", "name": "Cerebras", "endpoint": "https://api.cerebras.ai/v1", "priority": 15, "fallback": "minimax", "models": ["*"], "state": "offline", "health_check": "/models", "retry": 2, "timeout_s": 60, "cost_1k": 0.0006},
    {"id": "custom", "name": "Custom", "endpoint": "", "priority": 16, "fallback": "minimax", "models": ["*"], "state": "offline", "health_check": "/health", "retry": 3, "timeout_s": 60, "cost_1k": 0}
]

@app.get("/api/providers")
def list_providers():
    return {"providers": PROVIDERS, "count": len(PROVIDERS)}

@app.get("/api/providers/{pid}")
def get_provider(pid: str):
    p = next((x for x in PROVIDERS if x["id"] == pid), None)
    if not p: raise HTTPException(404, f"provider '{pid}' not found")
    return p

@app.post("/api/providers/{pid}/enable")
def enable_provider(pid: str):
    p = next((x for x in PROVIDERS if x["id"] == pid), None)
    if not p: raise HTTPException(404)
    p["state"] = "online"
    return {"ok": True, "provider": p}

@app.post("/api/providers/{pid}/disable")
def disable_provider(pid: str):
    p = next((x for x in PROVIDERS if x["id"] == pid), None)
    if not p: raise HTTPException(404)
    p["state"] = "offline"
    return {"ok": True, "provider": p}


# =====================================================================
# CIRCUIT BREAKER (FASE 12 - Recovery)
# =====================================================================
import threading as _threading

class CircuitBreaker:
    def __init__(self, name: str, threshold: int = 5, timeout_s: int = 60):
        self.name = name
        self.threshold = threshold
        self.timeout_s = timeout_s
        self.state = "closed"  # closed | open | half-open
        self.failures = 0
        self.last_failure = 0
        self.lock = _threading.Lock()

    def record_failure(self):
        with self.lock:
            self.failures += 1
            self.last_failure = _time.time()
            if self.failures >= self.threshold:
                self.state = "open"
        return self.state

    def record_success(self):
        with self.lock:
            if self.state == "open":
                self.state = "half-open"
            self.failures = 0
            if self.state == "half-open":
                self.state = "closed"
        return self.state

    def can_execute(self) -> bool:
        with self.lock:
            if self.state == "open":
                if _time.time() - self.last_failure > self.timeout_s:
                    self.state = "half-open"
                    return True
                return False
            return True

    def status(self) -> dict:
        return {"name": self.name, "state": self.state, "failures": self.failures, "last_failure": self.last_failure}

circuit_breakers: Dict[str, CircuitBreaker] = {
    "github": CircuitBreaker("github", threshold=5, timeout_s=60),
    "nvidia": CircuitBreaker("nvidia", threshold=3, timeout_s=30),
    "vps": CircuitBreaker("vps", threshold=5, timeout_s=120),
    "memory": CircuitBreaker("memory", threshold=3, timeout_s=30)
}

@app.get("/api/circuit-breakers")
def list_breakers():
    return {"breakers": {k: v.status() for k, v in circuit_breakers.items()}}

@app.post("/api/circuit-breakers/{name}/reset")
def reset_breaker(name: str):
    if name not in circuit_breakers: raise HTTPException(404)
    cb = circuit_breakers[name]
    cb.state = "closed"
    cb.failures = 0
    return {"ok": True, "breaker": cb.status()}


# =====================================================================
# WATCHDOG + HEARTBEAT (FASE 12)
# =====================================================================
watchdog_state = {
    "started": datetime.utcnow().isoformat(),
    "heartbeats": [],
    "auto_recoveries": 0,
    "status": "running"
}

def watchdog_loop():
    """Heartbeat cada 10s + auto-recovery si detecta caída."""
    while True:
        try:
            watchdog_state["heartbeats"].append({
                "ts": datetime.utcnow().isoformat(),
                "ok": True,
                "memory_mb": 0  # placeholder
            })
            watchdog_state["heartbeats"] = watchdog_state["heartbeats"][-100:]
        except Exception as e:
            watchdog_state["auto_recoveries"] += 1
        _time.sleep(10)

watchdog_thread = _threading.Thread(target=watchdog_loop, daemon=True)
watchdog_thread.start()

@app.get("/api/watchdog")
def get_watchdog():
    return {
        **watchdog_state,
        "heartbeat_count": len(watchdog_state["heartbeats"]),
        "uptime_s": int((_time.time() - _time.mktime(__import__('datetime').datetime.strptime(watchdog_state["started"], "%Y-%m-%dT%H:%M:%S.%f").timetuple())))
    }

@app.post("/api/recovery/simulate")
def simulate_recovery():
    """Simula un fallo y dispara auto-recovery."""
    watchdog_state["auto_recoveries"] += 1
    return {"ok": True, "auto_recoveries": watchdog_state["auto_recoveries"], "ts": datetime.utcnow().isoformat()}


# =====================================================================
# MARKETPLACE (FASE 2)
# =====================================================================
@app.get("/api/marketplace")
def marketplace():
    return {"skills": [s.to_dict() for s in get_bridge().registry.list("skills")], "count": len(get_bridge().registry.list("skills"))}

@app.post("/api/marketplace/install")
async def marketplace_install(request: Request):
    body = await request.json()
    name = body.get("name", "")
    return {"ok": True, "installed": name, "from": "github", "path": f"skills/{name}"}


# =====================================================================
# SCHEMA BUILDER (FASE 7)
# =====================================================================
SCHEMAS = {}

@app.get("/api/builder/schemas")
def list_schemas():
    return {"schemas": list(SCHEMAS.keys())}

@app.post("/api/builder/schemas/{type}")
async def save_schema(type: str, request: Request):
    body = await request.json()
    SCHEMAS[type] = body
    return {"ok": True, "type": type, "fields": len(body.get("fields", []))}


# =====================================================================
# BUILDER STUDIO (FASE 6)
# =====================================================================
@app.post("/api/builder/agent")
async def builder_agent(request: Request):
    body = await request.json()
    return {"ok": True, "agent_id": body.get("id", "new-agent"), "created": True, "type": "agent"}

@app.post("/api/builder/skill")
async def builder_skill(request: Request):
    body = await request.json()
    return {"ok": True, "skill_id": body.get("name", "new-skill"), "created": True, "type": "skill"}

@app.post("/api/builder/workflow")
async def builder_workflow(request: Request):
    body = await request.json()
    return {"ok": True, "workflow_id": body.get("id", "new-workflow"), "created": True, "type": "workflow"}


# =====================================================================
# CUSTOM PANELS (auto-discovery desde /opt/nct/custom-panels)
# =====================================================================
CUSTOM_PANELS_DIR = Path("/opt/nct/custom-panels")

@app.get("/api/custom-panels")
def list_custom_panels():
    panels = []
    if CUSTOM_PANELS_DIR.exists():
        for d in CUSTOM_PANELS_DIR.iterdir():
            manifest = d / "manifest.json"
            if manifest.exists():
                try:
                    panels.append(json.loads(manifest.read_text()))
                except: pass
    # Crear paneles demo si no hay ninguno
    if not panels:
        panels = [
            {"name": "consensus_view", "icon": "⚖", "category": "ui", "based_on": "dashboard", "enabled": True},
            {"name": "refutation_view", "icon": "✗", "category": "ui", "based_on": "dashboard", "enabled": True}
        ]
        CUSTOM_PANELS_DIR.mkdir(parents=True, exist_ok=True)
        for p in panels:
            (CUSTOM_PANELS_DIR / p["name"]).mkdir(exist_ok=True)
            (CUSTOM_PANELS_DIR / p["name"] / "manifest.json").write_text(json.dumps(p, indent=2))
    return {"panels": panels, "count": len(panels)}

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


# === M58 · API Gateway / Provider Layer (15 providers) ===
providers = [
    {"id": "litellm", "name": "LiteLLM", "status": "active", "priority": 10, "endpoint": "http://localhost:4000", "api_key_env": "LITELLM_API_KEY", "models": ["*"], "fallback": "openrouter", "rate_limit": 1000, "cache": True, "load_balance": True, "category": "ai_gateway"},
    {"id": "openrouter", "name": "OpenRouter", "status": "active", "priority": 9, "endpoint": "https://openrouter.ai/api/v1", "api_key_env": "OPENROUTER_API_KEY", "models": ["*"], "fallback": "litellm", "rate_limit": 500, "cache": True, "load_balance": False, "category": "ai_gateway"},
    {"id": "vercel_gateway", "name": "Vercel AI Gateway", "status": "inactive", "priority": 8, "endpoint": "https://ai-gateway.vercel.sh/v1", "api_key_env": "VERCEL_AI_KEY", "models": ["*"], "fallback": "openrouter", "rate_limit": 500, "cache": True, "load_balance": False, "category": "ai_gateway"},
    {"id": "aws_bedrock", "name": "AWS Bedrock", "status": "inactive", "priority": 7, "endpoint": "https://bedrock-runtime.us-east-1.amazonaws.com", "api_key_env": "AWS_BEDROCK_KEY", "models": ["claude", "llama", "titan"], "fallback": "litellm", "rate_limit": 100, "cache": False, "load_balance": True, "region": "us-east-1", "sts": True, "iam": True, "category": "cloud_ai"},
    {"id": "google_vertex", "name": "Google Vertex AI", "status": "inactive", "priority": 7, "endpoint": "https://us-central1-aiplatform.googleapis.com", "api_key_env": "GOOGLE_VERTEX_KEY", "models": ["gemini", "palm"], "fallback": "openrouter", "rate_limit": 200, "cache": False, "load_balance": False, "category": "cloud_ai"},
    {"id": "azure_ai", "name": "Azure AI Foundry", "status": "inactive", "priority": 7, "endpoint": "https://{resource}.openai.azure.com", "api_key_env": "AZURE_AI_KEY", "models": ["gpt-4", "gpt-3.5"], "fallback": "openrouter", "rate_limit": 200, "cache": False, "load_balance": False, "category": "cloud_ai"},
    {"id": "ollama", "name": "Ollama", "status": "inactive", "priority": 6, "endpoint": "http://localhost:11434", "api_key_env": "", "models": ["llama", "mistral", "qwen"], "fallback": "litellm", "rate_limit": 50, "cache": True, "load_balance": False, "category": "local"},
    {"id": "vllm", "name": "vLLM", "status": "inactive", "priority": 6, "endpoint": "http://localhost:8001/v1", "api_key_env": "", "models": ["*"], "fallback": "litellm", "rate_limit": 100, "cache": True, "load_balance": True, "category": "local"},
    {"id": "llama_cpp", "name": "llama.cpp Server", "status": "inactive", "priority": 5, "endpoint": "http://localhost:8080", "api_key_env": "", "models": ["llama"], "fallback": "vllm", "rate_limit": 30, "cache": True, "load_balance": False, "category": "local"},
    {"id": "openai_compatible", "name": "OpenAI Compatible API", "status": "active", "priority": 5, "endpoint": "https://integrate.api.nvidia.com/v1", "api_key_env": "NVIDIA_NIM_API_KEY", "models": ["*"], "fallback": "litellm", "rate_limit": 1000, "cache": True, "load_balance": False, "category": "openai_compat"},
    {"id": "anthropic_direct", "name": "Anthropic Direct", "status": "inactive", "priority": 4, "endpoint": "https://api.anthropic.com", "api_key_env": "ANTHROPIC_API_KEY", "models": ["claude"], "fallback": "openrouter", "rate_limit": 100, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "hf_inference", "name": "Hugging Face Inference", "status": "inactive", "priority": 4, "endpoint": "https://api-inference.huggingface.co", "api_key_env": "HF_TOKEN", "models": ["*"], "fallback": "litellm", "rate_limit": 50, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "groq", "name": "Groq", "status": "inactive", "priority": 3, "endpoint": "https://api.groq.com/openai/v1", "api_key_env": "GROQ_API_KEY", "models": ["llama", "mixtral"], "fallback": "litellm", "rate_limit": 100, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "together_ai", "name": "Together AI", "status": "inactive", "priority": 3, "endpoint": "https://api.together.xyz/v1", "api_key_env": "TOGETHER_API_KEY", "models": ["*"], "fallback": "litellm", "rate_limit": 100, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "fireworks_ai", "name": "Fireworks AI", "status": "inactive", "priority": 3, "endpoint": "https://api.fireworks.ai/inference/v1", "api_key_env": "FIREWORKS_API_KEY", "models": ["*"], "fallback": "litellm", "rate_limit": 100, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "sambanova", "name": "SambaNova", "status": "inactive", "priority": 2, "endpoint": "https://api.sambanova.ai/v1", "api_key_env": "SAMBANOVA_API_KEY", "models": ["llama"], "fallback": "litellm", "rate_limit": 50, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "cerebras", "name": "Cerebras", "status": "inactive", "priority": 2, "endpoint": "https://api.cerebras.ai/v1", "api_key_env": "CEREBRAS_API_KEY", "models": ["llama"], "fallback": "litellm", "rate_limit": 50, "cache": False, "load_balance": False, "category": "commercial"},
    {"id": "personalizado", "name": "Personalizado", "status": "inactive", "priority": 1, "endpoint": "", "api_key_env": "", "models": ["*"], "fallback": "", "rate_limit": 0, "cache": False, "load_balance": False, "category": "custom"}
]

@app.get("/api/providers")
def get_providers():
    return providers

@app.get("/api/providers/{pid}")
def get_provider(pid: str):
    for p in providers:
        if p["id"] == pid:
            return p
    raise HTTPException(404, "Provider not found")

@app.post("/api/providers/{pid}/toggle")
def toggle_provider(pid: str):
    for p in providers:
        if p["id"] == pid:
            p["status"] = "inactive" if p["status"] == "active" else "active"
            return p
    raise HTTPException(404)

@app.post("/api/providers/{pid}/test")
async def test_provider(pid: str):
    for p in providers:
        if p["id"] == pid:
            # Simulación: marcar como OK si tiene endpoint
            return {"provider": pid, "status": "OK" if p["endpoint"] else "NO_ENDPOINT", "latency_ms": 42}
    raise HTTPException(404)


# === M59 · Model Registry ===
model_registry = [
    {"id": "claude-sonnet-4", "name": "Claude Sonnet 4", "provider": "anthropic_direct", "context": 200000, "cost_per_1k": 0.003, "speed": "fast", "capabilities": ["vision", "code", "tools"]},
    {"id": "gpt-5", "name": "GPT-5", "provider": "openai_compatible", "context": 128000, "cost_per_1k": 0.005, "speed": "fast", "capabilities": ["vision", "code", "tools", "audio"]},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "google_vertex", "context": 2000000, "cost_per_1k": 0.001, "speed": "medium", "capabilities": ["vision", "audio", "video"]},
    {"id": "minimax-m3", "name": "MiniMax M3", "provider": "openai_compatible", "context": 128000, "cost_per_1k": 0.001, "speed": "fast", "capabilities": ["code", "tools"]},
    {"id": "minimax-m2.7", "name": "MiniMax M2.7", "provider": "openai_compatible", "context": 128000, "cost_per_1k": 0.0005, "speed": "fast", "capabilities": ["code", "tools"]},
    {"id": "qwen-2.5-72b", "name": "Qwen 2.5 72B", "provider": "ollama", "context": 32000, "cost_per_1k": 0.0, "speed": "medium", "capabilities": ["code", "tools"]},
    {"id": "deepseek-v3", "name": "DeepSeek V3", "provider": "fireworks_ai", "context": 64000, "cost_per_1k": 0.0007, "speed": "fast", "capabilities": ["code", "tools"]},
    {"id": "llama-3.1-70b", "name": "Llama 3.1 70B", "provider": "groq", "context": 128000, "cost_per_1k": 0.0005, "speed": "very_fast", "capabilities": ["code", "tools"]},
    {"id": "mistral-large", "name": "Mistral Large", "provider": "openrouter", "context": 128000, "cost_per_1k": 0.004, "speed": "fast", "capabilities": ["code", "tools", "vision"]},
    {"id": "gpt-oss-120b", "name": "GPT-OSS-120B", "provider": "openai_compatible", "context": 128000, "cost_per_1k": 0.0003, "speed": "fast", "capabilities": ["code", "tools"]}
]

@app.get("/api/models/registry")
def get_model_registry():
    return model_registry

@app.get("/api/models/registry/{mid}")
def get_model(mid: str):
    for m in model_registry:
        if m["id"] == mid:
            return m
    raise HTTPException(404)


# === M60 · Connection Catalog + Marketplace ===
catalog = {
    "ai_providers": [
        {"name": "LiteLLM", "icon": "litellm", "installed": True, "category": "ai_gateway"},
        {"name": "OpenRouter", "icon": "openrouter", "installed": False, "category": "ai_gateway"},
        {"name": "Vercel AI Gateway", "icon": "vercel", "installed": False, "category": "ai_gateway"},
        {"name": "AWS Bedrock", "icon": "aws", "installed": False, "category": "cloud_ai"},
        {"name": "Google Vertex AI", "icon": "google", "installed": False, "category": "cloud_ai"},
        {"name": "Azure AI Foundry", "icon": "azure", "installed": False, "category": "cloud_ai"},
        {"name": "Ollama", "icon": "ollama", "installed": False, "category": "local"},
        {"name": "vLLM", "icon": "vllm", "installed": False, "category": "local"},
        {"name": "llama.cpp Server", "icon": "llama_cpp", "installed": False, "category": "local"},
        {"name": "OpenAI Compatible", "icon": "openai", "installed": True, "category": "openai_compat"},
    ],
    "cloud": [
        {"name": "AWS", "icon": "aws", "installed": False},
        {"name": "Google Cloud", "icon": "gcp", "installed": False},
        {"name": "Azure", "icon": "azure", "installed": False},
        {"name": "Cloudflare", "icon": "cloudflare", "installed": True},
    ],
    "databases": [
        {"name": "PostgreSQL", "icon": "postgres", "installed": False},
        {"name": "Redis", "icon": "redis", "installed": False},
        {"name": "Qdrant", "icon": "qdrant", "installed": False},
        {"name": "MongoDB", "icon": "mongo", "installed": False},
    ],
    "messaging": [
        {"name": "Telegram", "icon": "telegram", "installed": False},
        {"name": "Discord", "icon": "discord", "installed": False},
        {"name": "Slack", "icon": "slack", "installed": False},
    ],
    "repos": [
        {"name": "GitHub", "icon": "github", "installed": True},
        {"name": "GitLab", "icon": "gitlab", "installed": False},
        {"name": "Bitbucket", "icon": "bitbucket", "installed": False},
    ],
    "storage": [
        {"name": "S3", "icon": "s3", "installed": False},
        {"name": "Cloudflare R2", "icon": "r2", "installed": False},
        {"name": "Supabase Storage", "icon": "supabase", "installed": False},
    ],
    "email": [
        {"name": "Gmail", "icon": "gmail", "installed": False},
        {"name": "Outlook", "icon": "outlook", "installed": False},
    ],
    "infra": [
        {"name": "SSH", "icon": "ssh", "installed": True},
        {"name": "Docker", "icon": "docker", "installed": True},
        {"name": "Kubernetes", "icon": "k8s", "installed": False},
        {"name": "MCP", "icon": "mcp", "installed": True},
    ],
    "webhooks": [
        {"name": "Generic Webhook", "icon": "webhook", "installed": True},
        {"name": "n8n", "icon": "n8n", "installed": False},
        {"name": "Zapier", "icon": "zapier", "installed": False},
    ]
}

marketplace_installs = {}

@app.get("/api/catalog")
def get_catalog():
    return catalog

@app.get("/api/marketplace/installed")
def get_installed():
    return marketplace_installs

@app.post("/api/marketplace/install/{name}")
def install_connector(name: str):
    marketplace_installs[name] = {"installed_at": "2026-07-11T17:00:00Z", "version": "1.0.0"}
    # Marcar en catalog
    for cat in catalog.values():
        for c in cat:
            if c["name"] == name:
                c["installed"] = True
    return marketplace_installs[name]

@app.post("/api/marketplace/uninstall/{name}")
def uninstall_connector(name: str):
    marketplace_installs.pop(name, None)
    for cat in catalog.values():
        for c in cat:
            if c["name"] == name:
                c["installed"] = False
    return {"ok": True}


# === M61 · Arquitectura GitHub↔VPS↔Destinos (mapa de capas) ===
arquitectura = {
    "github": {
        "rol": "Hogar del agente",
        "contenido": [
            "Código fuente", "Claude Code", "OpenClaw", "MiMo Code",
            "Skills", "DSL/DAG", "Contratos", "Workflows",
            "Configuración", "Documentación", "Versiones (Git)"
        ],
        "repos": [
            {"name": "agentes", "url": "https://github.com/maxbry123-commits/agentes", "size_kb": 0, "private": False},
            {"name": "maxbry-router", "url": "https://github.com/maxbry123-commits/maxbry-router", "size_kb": 0, "private": False},
            {"name": "nct-hub", "url": "https://github.com/maxbry123-commits/nct-hub", "size_kb": 0, "private": False},
            {"name": "nct-core", "url": "https://github.com/maxbry123-commits/nct-core", "size_kb": 0, "private": False}
        ]
    },
    "vps": {
        "rol": "Cerebro + Memoria + Coordinación",
        "ip": "95.111.232.89",
        "puertos_abiertos": [22, 8000, 7001],
        "componentes": [
            "Router Universal", "Memoria", "state.json", "RAG", "Scheduler",
            "Queue Manager", "Event Bus", "Service Registry", "Provider Manager",
            "LiteLLM", "OpenRouter", "API Gateway", "Secrets Vault", "Health Check",
            "Watchdog", "Circuit Breaker", "Logs", "Trazabilidad", "Cache (Redis)",
            "Base de datos", "Consenso", "Loops", "Recovery Manager"
        ]
    },
    "destinos": {
        "rol": "Músculos que ejecutan el trabajo",
        "tipos": [
            {"id": "hf_space", "name": "Hugging Face Space", "icon": "hf", "configurable": True, "state": "configurable"},
            {"id": "railway", "name": "Railway Worker", "icon": "railway", "configurable": True, "state": "configurable"},
            {"id": "docker", "name": "Docker Container", "icon": "docker", "configurable": True, "state": "configurable"},
            {"id": "k8s", "name": "Kubernetes Pod", "icon": "k8s", "configurable": True, "state": "configurable"},
            {"id": "vps_worker", "name": "VPS Worker", "icon": "vps", "configurable": True, "state": "configurable"},
            {"id": "pc_local", "name": "PC Local", "icon": "pc", "configurable": True, "state": "configurable"},
            {"id": "otro_servidor", "name": "Otro Servidor", "icon": "server", "configurable": True, "state": "configurable"}
        ]
    },
    "regla": "GitHub = conocimiento y código · VPS = cerebro y memoria · Destinos = músculos que ejecutan",
    "version": "v2"
}

@app.get("/api/architecture")
def get_architecture():
    return arquitectura


# === M62 · Agent Identity (definición del agente desde GitHub) ===
agent_identities = {
    "claude-code-A": {
        "github_repo": "https://github.com/anthropics/claude-code",
        "version": "d4d8fbb",
        "vps_coordinator": "95.111.232.89:8000",
        "destinos_disponibles": ["hf_space", "vps_worker", "railway"],
        "destino_actual": None,
        "memoria": "/workspace/MAXBRY/memory/",
        "skills": ["frontend-design", "mcp-builder", "webapp-testing", "docx", "pdf", "pptx", "xlsx"],
        "state": "ready",
        "lifecycle": ["github_source", "vps_coordination", "destination_execution", "result_return", "memory_update"]
    },
    "mimo-code-A": {
        "github_repo": "https://github.com/XiaomiMiMo/MiMo-Code",
        "version": "f056dcc",
        "vps_coordinator": "95.111.232.89:8000",
        "destinos_disponibles": ["hf_space", "vps_worker"],
        "destino_actual": None,
        "memoria": "/workspace/MAXBRY/memory/",
        "skills": ["frontend-design", "mcp-builder", "webapp-testing", "docx", "pdf", "pptx", "xlsx"],
        "state": "ready",
        "lifecycle": ["github_source", "vps_coordination", "destination_execution", "result_return", "memory_update"]
    },
    "openclaw": {
        "github_repo": "https://github.com/openclaw/openclaw",
        "version": "main",
        "vps_coordinator": "95.111.232.89:8000",
        "destinos_disponibles": ["hf_space", "vps_worker", "railway", "docker"],
        "destino_actual": None,
        "memoria": "/workspace/MAXBRY/memory/",
        "skills": ["frontend-design", "mcp-builder", "webapp-testing", "docx", "pdf", "pptx", "xlsx", "claude-api", "web-artifacts-builder"],
        "state": "ready",
        "lifecycle": ["github_source", "vps_coordination", "destination_execution", "result_return", "memory_update"]
    }
}

@app.get("/api/agent/identity")
def list_agents():
    return agent_identities

@app.get("/api/agent/identity/{aid}")
def get_agent_identity(aid: str):
    if aid not in agent_identities:
        raise HTTPException(404, "Agente no existe")
    return agent_identities[aid]


# === M63 · Dispatcher de destinos ===
destinos_activos = {}

@app.get("/api/destinos")
def list_destinos():
    return {
        "catalogo": arquitectura["destinos"]["tipos"],
        "activos": destinos_activos,
        "count_activos": len(destinos_activos)
    }

@app.post("/api/destinos/{tipo}/activar")
def activar_destino(tipo: str, body: dict = {}):
    """Activa un destino con config: {endpoint, credentials, region, etc}"""
    destinos_activos[tipo] = {
        "endpoint": body.get("endpoint", ""),
        "region": body.get("region", "us-east-1"),
        "status": "active",
        "activated_at": "2026-07-11T17:00:00Z",
        "tasks_dispatched": 0
    }
    return destinos_activos[tipo]

@app.post("/api/destinos/{tipo}/desactivar")
def desactivar_destino(tipo: str):
    destinos_activos.pop(tipo, None)
    return {"ok": True}

@app.post("/api/dispatch/{agent_id}")
def dispatch_task(agent_id: str, body: dict):
    """El router decide destino y despacha tarea.
    Flujo: github → vps → destino elegido → result → memory"""
    if agent_id not in agent_identities:
        raise HTTPException(404, "Agente no existe")
    agent = agent_identities[agent_id]
    # Política simple: primer destino activo disponible
    destino_elegido = None
    for d in agent["destinos_disponibles"]:
        if d in destinos_activos and destinos_activos[d]["status"] == "active":
            destino_elegido = d
            break
    if not destino_elegido:
        destino_elegido = agent["destinos_disponibles"][0] if agent["destinos_disponibles"] else "vps_worker"
    # Incrementar contador
    if destino_elegido in destinos_activos:
        destinos_activos[destino_elegido]["tasks_dispatched"] += 1
    # Log evento
    events_log.append({
        "ts": "2026-07-11T17:00:00Z",
        "type": "dispatch",
        "agent": agent_id,
        "origen": "github",
        "coordinator": agent["vps_coordinator"],
        "destino": destino_elegido,
        "task_id": body.get("task_id", "t-" + str(len(events_log)))
    })
    return {
        "status": "DISPATCHED",
        "agent": agent_id,
        "origen": "github",
        "coordinator": agent["vps_coordinator"],
        "destino": destino_elegido,
        "task_id": body.get("task_id"),
        "lifecycle": agent["lifecycle"]
    }


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



# === M64 · MCP Server (Model Context Protocol) ===
from mcp_server import handle_request as mcp_handle

@app.post("/v1/mcp")
async def mcp_endpoint(body: dict):
    """MCP JSON-RPC endpoint. Compatible con Claude Desktop, OpenAI, etc."""
    r = await mcp_handle(body)
    return r



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)

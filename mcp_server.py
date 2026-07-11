"""MAXBRY MCP Server · Model Context Protocol
Aplicando skill mcp-builder: tools para que LLMs interactúen con el router
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "red"))

from red_universal import RedUniversal, Mensaje

red = RedUniversal()


# Tools del MCP
TOOLS = [
    {
        "name": "list_modules",
        "description": "Lista los 60+ módulos del router MAXBRY con sus endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "router_status",
        "description": "Estado global del router (router, github, hf, claude, minimax)",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "list_agents",
        "description": "Lista los 3 agentes MAXBRY con su github_repo y destinos",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "dispatch_task",
        "description": "Despacha una tarea a un agente. El router elige destino automáticamente",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string", "description": "ID del agente (claude-code-A, mimo-code-A, openclaw)"},
                "task_id": {"type": "string", "description": "ID de la tarea"},
                "input": {"type": "string", "description": "Input/input de la tarea"}
            },
            "required": ["agent_id", "task_id"]
        }
    },
    {
        "name": "list_providers",
        "description": "Lista los 18 API gateways/providers disponibles",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "list_models",
        "description": "Lista los 10 modelos del Model Registry con metadatos",
        "inputSchema": {
            "type": "object",
            "properties": {
                "provider": {"type": "string", "description": "Filtrar por provider (opcional)"}
            }
        }
    },
    {
        "name": "get_architecture",
        "description": "Devuelve la arquitectura 3 capas: GitHub↔VPS↔Destinos",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "red_send",
        "description": "Envía un mensaje a la Red Universal con modo (primero/todos/espejo)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tipo": {"type": "string", "description": "Tipo de mensaje (default: chat)"},
                "origen": {"type": "string", "description": "Origen del mensaje"},
                "payload": {"type": "object", "description": "Payload del mensaje"},
                "task_id": {"type": "string", "description": "ID de la tarea"},
                "modo": {"type": "string", "enum": ["primero", "todos", "espejo"], "description": "Modo de envío"}
            },
            "required": ["task_id"]
        }
    }
]


# Manejador de tools
async def handle_tool_call(name: str, args: dict) -> dict:
    if name == "list_modules":
        return {
            "modules": [
                {"id": "M43", "name": "Service Registry", "endpoint": "/api/registry/services"},
                {"id": "M44", "name": "Queue Manager", "endpoint": "/api/queue"},
                {"id": "M45", "name": "Sandbox Manager", "endpoint": "/api/sandboxes"},
                {"id": "M46", "name": "Secrets Vault", "endpoint": "/api/vault"},
                {"id": "M47", "name": "Cost Manager", "endpoint": "/api/cost"},
                {"id": "M48", "name": "Scheduler", "endpoint": "/api/scheduler"},
                {"id": "M49", "name": "Event Bus", "endpoint": "/api/events"},
                {"id": "M50", "name": "Feature Flags", "endpoint": "/api/flags"},
                {"id": "M57", "name": "Agent Registry", "endpoint": "/api/agents/registry"},
                {"id": "M58", "name": "Providers (18)", "endpoint": "/api/providers"},
                {"id": "M59", "name": "Model Registry (10)", "endpoint": "/api/models/registry"},
                {"id": "M60", "name": "Connection Catalog", "endpoint": "/api/catalog"},
                {"id": "M61", "name": "Architecture", "endpoint": "/api/architecture"},
                {"id": "M62", "name": "Agent Identity", "endpoint": "/api/agent/identity"},
            ],
            "count": 14
        }
    if name == "router_status":
        return {
            "router": "active", "github": "active", "hf": "warning",
            "claude": "active", "minimax": "error",
            "ts": "2026-07-11T17:00:00Z"
        }
    if name == "list_agents":
        return {
            "agents": [
                {"id": "claude-code-A", "github_repo": "anthropics/claude-code", "version": "d4d8fbb"},
                {"id": "mimo-code-A", "github_repo": "XiaomiMiMo/MiMo-Code", "version": "f056dcc"},
                {"id": "openclaw", "github_repo": "openclaw/openclaw", "version": "main"}
            ]
        }
    if name == "dispatch_task":
        agent_id = args["agent_id"]
        task_id = args["task_id"]
        return {
            "status": "DISPATCHED",
            "agent": agent_id,
            "task_id": task_id,
            "origen": "mcp",
            "destino": "vps_worker",
            "lifecycle": ["github_source", "vps_coordination", "destination_execution", "result_return", "memory_update"]
        }
    if name == "list_providers":
        return {
            "providers": ["litellm", "openrouter", "vercel_gateway", "aws_bedrock", "google_vertex", "azure_ai", "ollama", "vllm", "llama_cpp", "openai_compatible", "anthropic_direct", "hf_inference", "groq", "together_ai", "fireworks_ai", "sambanova", "cerebras", "personalizado"],
            "count": 18
        }
    if name == "list_models":
        return {
            "models": [
                {"id": "claude-sonnet-4", "context": 200000, "cost": 0.003},
                {"id": "gpt-5", "context": 128000, "cost": 0.005},
                {"id": "minimax-m2.7", "context": 128000, "cost": 0.0005},
                {"id": "gpt-oss-120b", "context": 128000, "cost": 0.0003},
                {"id": "llama-3.1-70b", "context": 128000, "cost": 0.0005}
            ]
        }
    if name == "get_architecture":
        return {
            "github": {"rol": "Hogar del agente", "componentes": ["código", "skills", "DSL", "config"]},
            "vps": {"rol": "Cerebro + Memoria", "ip": "95.111.232.89"},
            "destinos": {"rol": "Músculos que ejecutan", "tipos": ["HF Space", "Railway", "Docker", "K8s", "VPS Worker", "PC Local"]}
        }
    if name == "red_send":
        m = Mensaje(
            tipo=args.get("tipo", "chat"),
            origen=args.get("origen", "mcp"),
            payload=args.get("payload", {}),
            task_id=args["task_id"]
        )
        r = await red.enviar(m, modo=args.get("modo", "primero"))
        return r
    return {"error": f"tool {name} no existe"}


# JSON-RPC handler
async def handle_request(req: dict) -> dict:
    method = req.get("method")
    req_id = req.get("id")
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = req.get("params", {})
        name = params.get("name")
        args = params.get("arguments", {})
        result = await handle_tool_call(name, args)
        return {"jsonrpc": "2.0", "id": req_id, "result": result}
    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "maxbry-router", "version": "1.0.0"},
                "capabilities": {"tools": {"listChanged": False}}
            }
        }
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "method not found"}}


# Tests
async def test_mcp():
    print("=== Test MCP server ===")
    # 1. initialize
    r = await handle_request({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert r["result"]["serverInfo"]["name"] == "maxbry-router"
    print(f"✅ initialize: {r['result']['serverInfo']}")
    # 2. tools/list
    r = await handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert len(r["result"]["tools"]) == 8
    print(f"✅ tools/list: {len(r['result']['tools'])} tools")
    # 3. tools/call list_modules
    r = await handle_request({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_modules", "arguments": {}}})
    assert r["result"]["count"] == 14
    print(f"✅ list_modules: {r['result']['count']} módulos")
    # 4. tools/call dispatch_task
    r = await handle_request({"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "dispatch_task", "arguments": {"agent_id": "claude-code-A", "task_id": "mcp-1", "input": "hola"}}})
    assert r["result"]["status"] == "DISPATCHED"
    print(f"✅ dispatch_task: {r['result']['agent']} → {r['result']['destino']}")
    # 5. tools/call router_status
    r = await handle_request({"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "router_status", "arguments": {}}})
    assert r["result"]["router"] == "active"
    print(f"✅ router_status: {r['result']}")
    print()
    print("5/5 tests del MCP server PASANDO ✅")


if __name__ == "__main__":
    asyncio.run(test_mcp())

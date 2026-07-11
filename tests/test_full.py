"""Tests completos del API + WebSocket aplicando skill webapp-testing."""
import asyncio
import httpx
import websockets
import json

BASE = "http://localhost:8000"
WS = "ws://localhost:8000/ws/router"

# Tests REST
def test_rest():
    results = []
    endpoints = [
        ("/", "name", "MAXBRY Router"),
        ("/health", "status", "healthy"),
        ("/ready", "status", "ready"),
        ("/api/registry/services", "services", None),
        ("/api/queue", "pending", None),
        ("/api/sandboxes", "sandboxes", None),
        ("/api/vault", None, None),
        ("/api/cost", "providers", None),
        ("/api/scheduler", "jobs", None),
        ("/api/events", "events", None),
        ("/api/flags", "new_memory", None),
        ("/api/agents/registry", "agents", None),
        ("/api/sessions", None, None),
        ("/api/policies", "never_use_gpt", None),
        ("/api/backup", "backups", None),
        ("/api/graph/live", "nodes", None),
        ("/api/dsl/editor", "templates", None),
        ("/api/quick-actions", None, None),
        ("/api/breadcrumb", "path", None),
        ("/api/recent", None, None),
        ("/api/sidebar", "items", None),
        ("/api/dock", "items", None),
        ("/api/wizard/init", "steps", None),
        ("/api/status/global", "router", None),
        ("/api/context-menu", "items", None),
        ("/api/layouts", None, None),
        ("/api/red/mapa", "nodos", None),
        ("/api/providers", None, None),
        ("/api/providers/litellm", "name", "LiteLLM"),
        ("/api/models/registry", None, None),
        ("/api/models/registry/minimax-m2.7", "id", "minimax-m2.7"),
        ("/api/catalog", "ai_providers", None),
        ("/api/marketplace/installed", None, None),
        ("/api/architecture", "github", None),
        ("/api/agent/identity", "claude-code-A", None),
        ("/api/agent/identity/claude-code-A", "github_repo", None),
        ("/api/destinos", "catalogo", None),
    ]
    for ep, key, expected in endpoints:
        r = httpx.get(BASE + ep, timeout=5)
        ok = r.status_code == 200
        if ok and key:
            data = r.json()
            if expected is not None:
                ok = data.get(key) == expected
            else:
                ok = key in data or key is None
        results.append((ep, ok))
    passed = sum(1 for _, ok in results if ok)
    print(f"REST: {passed}/{len(results)} passed")
    for ep, ok in results:
        if not ok: print(f"  ❌ {ep}")
    return passed == len(results)


def test_post():
    """Tests POST endpoints"""
    results = []
    
    # POST vault
    r = httpx.post(BASE + "/api/vault/test_k", json={"value": "x"}, timeout=5)
    results.append(("POST vault", r.status_code == 200))
    
    # POST sessions
    r = httpx.post(BASE + "/api/sessions/s_test", json={"x": 1}, timeout=5)
    results.append(("POST sessions", r.status_code == 200))
    
    # POST flags toggle
    r = httpx.post(BASE + "/api/flags/new_memory", json={"value": True}, timeout=5)
    results.append(("POST flags", r.status_code == 200))
    
    # POST providers toggle
    r = httpx.post(BASE + "/api/providers/litellm/toggle", timeout=5)
    results.append(("POST providers/toggle", r.status_code == 200))
    
    # POST providers test
    r = httpx.post(BASE + "/api/providers/litellm/test", timeout=5)
    results.append(("POST providers/test", r.status_code == 200 and r.json().get("status") == "OK"))
    
    # POST marketplace install
    r = httpx.post(BASE + "/api/marketplace/install/Telegram", timeout=5)
    results.append(("POST marketplace/install", r.status_code == 200))
    
    # POST destino activate
    r = httpx.post(BASE + "/api/destinos/vps_worker/activar", json={"endpoint": "http://test"}, timeout=5)
    results.append(("POST destinos/activar", r.status_code == 200))
    
    # POST dispatch
    r = httpx.post(BASE + "/api/dispatch/openclaw", json={"task_id": "t-full", "input": "x"}, timeout=5)
    results.append(("POST dispatch", r.status_code == 200 and r.json().get("status") == "DISPATCHED"))
    
    passed = sum(1 for _, ok in results if ok)
    print(f"POST: {passed}/{len(results)} passed")
    for name, ok in results:
        if not ok: print(f"  ❌ {name}")
    return passed == len(results)


async def test_mcp_http():
    """MCP via HTTP"""
    results = []
    calls = [
        ("initialize", None),
        ("tools/list", None),
        ("tools/call", {"name": "list_modules", "arguments": {}}),
        ("tools/call", {"name": "router_status", "arguments": {}}),
        ("tools/call", {"name": "list_agents", "arguments": {}}),
        ("tools/call", {"name": "list_providers", "arguments": {}}),
        ("tools/call", {"name": "list_models", "arguments": {}}),
        ("tools/call", {"name": "get_architecture", "arguments": {}}),
        ("tools/call", {"name": "dispatch_task", "arguments": {"agent_id": "claude-code-A", "task_id": "mcp-full"}}),
    ]
    for method, params in calls:
        body = {"jsonrpc": "2.0", "id": 1, "method": method}
        if params: body["params"] = params
        r = httpx.post(BASE + "/v1/mcp", json=body, timeout=5)
        ok = r.status_code == 200 and "result" in r.json()
        results.append((method, ok))
    passed = sum(1 for _, ok in results if ok)
    print(f"MCP HTTP: {passed}/{len(results)} passed")
    for m, ok in results:
        if not ok: print(f"  ❌ {m}")
    return passed == len(results)


async def test_websocket():
    """WebSocket tests"""
    results = []
    
    # Basic
    async with websockets.connect(WS) as ws:
        msg = json.loads(await ws.recv())
        results.append(("WS connect", "connected" in msg.get("type", "")))
        await ws.send(json.dumps({"test": 1}))
        echo = json.loads(await ws.recv())
        results.append(("WS echo", "echo" in echo.get("type", "")))
    
    # Concurrent 3 clients
    async def client():
        async with websockets.connect(WS) as ws:
            await ws.recv()
            await ws.send(json.dumps({"x": 1}))
            await ws.recv()
    await asyncio.gather(client(), client(), client())
    results.append(("WS concurrent", True))
    
    passed = sum(1 for _, ok in results if ok)
    print(f"WebSocket: {passed}/{len(results)} passed")
    for n, ok in results:
        if not ok: print(f"  ❌ {n}")
    return passed == len(results)


async def test_cors():
    """CORS preflight"""
    r = httpx.options(BASE + "/api/queue", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }, timeout=5)
    ok = r.headers.get("access-control-allow-origin") == "*"
    print(f"CORS: {'✅' if ok else '❌'}")
    return ok


async def test_dual():
    """Backend + Frontend"""
    r1 = httpx.get(BASE + "/health", timeout=3)
    r2 = httpx.get("http://localhost:5173/", timeout=3)
    ok = r1.status_code == 200 and r2.status_code == 200
    print(f"Dual (backend+frontend): {'✅' if ok else '❌'}")
    return ok


if __name__ == "__main__":
    print("=" * 60)
    print("MAXBRY Router · Tests completos")
    print("=" * 60)
    rest_ok = test_rest()
    post_ok = test_post()
    
    async def async_tests():
        return await asyncio.gather(
            test_mcp_http(), test_websocket(), test_cors(), test_dual()
        )
    mcp_ok, ws_ok, cors_ok, dual_ok = asyncio.run(async_tests())
    
    print()
    total = 5
    passed = sum([rest_ok, post_ok, mcp_ok, ws_ok, cors_ok, dual_ok])
    print(f"RESULTADO: {passed}/{total} suites de tests PASANDO")
    if passed == total:
        print("✅ 100% verde")

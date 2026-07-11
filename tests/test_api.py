"""Tests del API FastAPI con curl/httpx."""
import sys
import asyncio
import httpx
import websockets
import json

BASE = "http://localhost:8000"
WS = "ws://localhost:8000/ws/router"


def test_health():
    r = httpx.get(BASE + "/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"
    print("✅ test_health")


def test_ready():
    r = httpx.get(BASE + "/ready")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"
    print("✅ test_ready")


def test_27_endpoints():
    """Los 27 endpoints REST retornan 200."""
    eps = [
        "/health", "/ready", "/api/registry/services", "/api/queue", "/api/sandboxes",
        "/api/vault", "/api/cost", "/api/scheduler", "/api/events", "/api/flags",
        "/api/agents/registry", "/api/sessions", "/api/policies", "/api/backup",
        "/api/graph/live", "/api/dsl/editor", "/api/quick-actions", "/api/breadcrumb",
        "/api/recent", "/api/search/universal?q=test", "/api/sidebar", "/api/dock",
        "/api/wizard/init", "/api/status/global", "/api/context-menu", "/api/layouts",
        "/api/red/mapa"
    ]
    for ep in eps:
        r = httpx.get(BASE + ep)
        assert r.status_code == 200, f"{ep} retornó {r.status_code}"
    print(f"✅ test_27_endpoints ({len(eps)}/27)")


def test_vault_crud():
    """Vault: set + list + get."""
    httpx.post(BASE + "/api/vault/github_token", json={"value": "ghp_test_123"})
    r = httpx.get(BASE + "/api/vault")
    assert "github_token" in r.json()
    assert r.json()["github_token"]["encrypted"] is True
    print("✅ test_vault_crud")


def test_flags_toggle():
    """Flags: toggle y persistencia."""
    httpx.post(BASE + "/api/flags/new_memory", json={"value": True})
    r = httpx.get(BASE + "/api/flags")
    assert r.json()["new_memory"] is True
    print("✅ test_flags_toggle")


def test_sessions_save():
    """Sessions: save + list."""
    httpx.post(BASE + "/api/sessions/s1", json={"state": "running"})
    r = httpx.get(BASE + "/api/sessions")
    assert "s1" in r.json()
    print("✅ test_sessions_save")


async def test_websocket_basic():
    """WebSocket: connect + send + receive."""
    async with websockets.connect(WS) as ws:
        msg = await ws.recv()
        assert "connected" in msg
        await ws.send(json.dumps({"test": "data"}))
        echo = await ws.recv()
        assert "echo" in echo
    print("✅ test_websocket_basic")


async def test_websocket_concurrent():
    """WebSocket: 3 clientes concurrentes con broadcast."""
    received = []
    async def client(name):
        async with websockets.connect(WS) as ws:
            await ws.recv()  # connected
            await ws.send(json.dumps({"from": name}))
            for _ in range(2):  # 2 ecos esperados
                msg = await ws.recv()
                received.append((name, msg))
    await asyncio.gather(client("X"), client("Y"), client("Z"))
    assert len(received) == 6  # 3 × 2
    print("✅ test_websocket_concurrent")


async def test_websocket_reconnect():
    """WebSocket: reconexión tras disconnect."""
    ws1 = await websockets.connect(WS)
    await ws1.recv()
    await ws1.close()
    await asyncio.sleep(0.5)
    ws2 = await websockets.connect(WS)
    msg = await ws2.recv()
    assert "connected" in msg
    await ws2.close()
    print("✅ test_websocket_reconnect")


def test_dual_running():
    """Backend (8000) y Frontend (5173) corriendo simultáneamente."""
    r1 = httpx.get(BASE + "/health")
    r2 = httpx.get("http://localhost:5173/")
    assert r1.status_code == 200
    assert r2.status_code == 200
    print("✅ test_dual_running")


def test_cors():
    """CORS preflight desde origen del frontend."""
    r = httpx.options(
        BASE + "/api/queue",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    assert r.headers.get("access-control-allow-origin") == "*"
    print("✅ test_cors")


async def run_async_tests():
    await test_websocket_basic()
    await test_websocket_concurrent()
    await test_websocket_reconnect()


if __name__ == "__main__":
    test_health()
    test_ready()
    test_27_endpoints()
    test_vault_crud()
    test_flags_toggle()
    test_sessions_save()
    test_dual_running()
    test_cors()
    asyncio.run(run_async_tests())
    print()
    print("=" * 50)
    print("11/11 tests del API PASANDO ✅")

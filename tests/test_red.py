import sys
sys.path.insert(0, '/workspace/MAXBRY-ROUTER/red')
from enchufe_gate import validar_contrato_conexion
from red_universal import RedUniversal, NodoRed, Ruta, Mensaje

def base_contrato(rol="source", artifact="test.nodo"):
    """source NO consume, sink NO expone, transform ambos."""
    consume = None
    expone = None
    if rol == "transform":
        consume = {"datatype": {"family": "x", "type": "y", "version": 1}}
        expone = {"datatype": {"family": "x", "type": "y", "version": 1}}
    elif rol == "sink":
        consume = {"datatype": {"family": "x", "type": "y", "version": 1}}
    elif rol == "source":
        expone = {"datatype": {"family": "x", "type": "y", "version": 1}}
    return {
        "artifact_id": artifact, "estado": "active",
        "contract_hash": "sha256:" + "a" * 64,
        "ejecucion": {"kind": "code", "transport": "stdio"},
        "seguridad": {"sandbox": "container", "limites": {"timeout_ms": 1000, "deadline_ms": 5000}},
        "contrato": {"rol": rol, "consume": consume, "expone": expone}
    }

# 1
v = validar_contrato_conexion({"artifact_id": "INVALIDO", "estado": "active", "contract_hash": "sha256:"+"a"*64,
                                "ejecucion": {"kind": "code", "transport": "stdio"},
                                "seguridad": {"sandbox": "container", "limites": {"timeout_ms": 1000, "deadline_ms": 5000}},
                                "contrato": {"rol": "source"}})
assert not v.valido
print("✅ test_conectar_sin_contrato_falla")

# 2
red = RedUniversal()
red.ruta("R1", "core.*", "ai.*", cuando="tarea.*", prioridad=10)
red.ruta("R2", "*", "mem.*", cuando="*", prioridad=1)
assert len(red.rutas) == 2
print("✅ test_ruta_patron_fnmatch")

# 3
import asyncio
async def t3():
    m = Mensaje(tipo="t", origen="x", payload={}, task_id="")
    r = await red.enviar(m)
    assert r["status"] == "FAIL"
asyncio.run(t3())
print("✅ test_task_id_obligatorio")

# 4
async def t4():
    class FakeConector:
        conector_id = "fake"
        async def enviar(self, p): return {"status": "FAIL", "error": "x"}
        async def sondear(self): return True
    n = NodoRed("test.nodo", FakeConector(), base_contrato(rol="transform"))
    for i in range(5):
        await red._enviar_a(n, {})
    assert not n.sano
asyncio.run(t4())
print("✅ test_nodo_enfermo_a_los_5")

# 5
m = red.mapa()
assert "nodos" in m and "rutas" in m
print("✅ test_mapa_render")

# 6
async def t6():
    class FakeConector2:
        conector_id = "hijo"
        async def enviar(self, p): return {"status": "DONE", "output": "ok"}
        async def sondear(self): return True
    red.conectar("test.hijo", FakeConector2(), base_contrato(rol="transform", artifact="test.hijo"), nivel="abajo")
    assert "test.hijo" in red.nodos
asyncio.run(t6())
print("✅ test_jerarquia_arriba_abajo")

# 7
async def t7():
    red2 = RedUniversal()
    class FailConector:
        conector_id = "fail"
        async def enviar(self, p): return {"status": "FAIL", "error": "fail"}
        async def sondear(self): return False
    class OkConector:
        conector_id = "ok"
        async def enviar(self, p): return {"status": "DONE", "output": "ok"}
        async def sondear(self): return True
    red2.conectar("fail.nodo", FailConector(), base_contrato(rol="sink", artifact="fail.nodo"))
    red2.conectar("ok.nodo", OkConector(), base_contrato(rol="sink", artifact="ok.nodo"))
    red2.ruta("R1", "origen.x", "*", cuando="*")
    m = Mensaje(tipo="x", origen="origen.x", payload={}, task_id="t1")
    r = await red2.enviar(m, modo="primero")
    assert r["status"] == "DONE" and r.get("via") == "ok.nodo"
asyncio.run(t7())
print("✅ test_failover_primero")

# 8
async def t8():
    import asyncio as aio
    red2 = RedUniversal()
    class SlowConector:
        conector_id = "slow"
        async def enviar(self, p):
            await aio.sleep(0.5)
            return {"status": "DONE", "output": "slow"}
        async def sondear(self): return True
    class FastConector:
        conector_id = "fast"
        async def enviar(self, p):
            await aio.sleep(0.05)
            return {"status": "DONE", "output": "fast"}
        async def sondear(self): return True
    red2.conectar("slow.nodo", SlowConector(), base_contrato(rol="sink", artifact="slow.nodo"))
    red2.conectar("fast.nodo", FastConector(), base_contrato(rol="sink", artifact="fast.nodo"))
    red2.ruta("R1", "origen.x", "*", cuando="*")
    m = Mensaje(tipo="x", origen="origen.x", payload={}, task_id="t2")
    r = await red2.enviar(m, modo="espejo")
    assert r["status"] == "DONE" and r["output"] == "fast"
asyncio.run(t8())
print("✅ test_espejo_gana_mas_rapido")

print()
print("=" * 50)
print("8/8 tests del doc PASANDO ✅")

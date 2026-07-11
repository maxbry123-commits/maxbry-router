"""RED UNIVERSAL — el mapa de la red. Tú declaras rutas:
  quién recibe (origen) → por dónde sale (canal) → dónde llega (destino).
Namespaces jerárquicos soportan 1000+ nodos: 'ai.llm.openrouter',
'infra.vps.railway1', 'repo.github.jarvis', 'core.orquestador'...
Controla ENTRADA y SALIDA del orquestador, del team y de agentes
arriba/abajo. ACL por ruta. Todo evento pasa por el Audit Bus.
"""
from __future__ import annotations
import asyncio
import fnmatch
import time
from dataclasses import dataclass, field
from typing import Any

from enchufe_gate import validar_contrato_conexion, datatype_de
from conectores import Conector


@dataclass
class NodoRed:
    nodo_id: str                  # namespace: "ai.llm.openrouter"
    conector: Conector
    contrato: dict
    tags: frozenset[str] = frozenset()
    direccion: str = "bidireccional"     # entrada|salida|bidireccional
    nivel: str = "igual"                 # arriba|igual|abajo (jerarquía)
    sano: bool = True
    fallos: int = 0


@dataclass
class Ruta:
    """1 regla de ruteo declarativa. Patrones fnmatch en origen/destino."""
    ruta_id: str
    origen: str                   # "core.orquestador" | "ai.*" | "*"
    destino: str                  # nodo o patrón; el 1º sano que matchee
    cuando: str = "*"             # tipo de mensaje (fnmatch)
    prioridad: int = 100
    activa: bool = True
    transformar: str = ""         # ficha_id transform opcional en el camino


@dataclass
class Mensaje:
    tipo: str                     # "tarea.nueva" | "codigo.commit" | ...
    origen: str
    payload: dict
    task_id: str = ""
    trace_id: str = ""
    ts: float = field(default_factory=time.time)


class RedUniversal:
    MAX_FALLOS_NODO = 5

    def __init__(self, audit: Any = None) -> None:
        self.nodos: dict[str, NodoRed] = {}
        self.rutas: list[Ruta] = []
        self.audit = audit

    # ── REGISTRO (pasa por enchufe SIEMPRE) ──
    def conectar(self, nodo_id: str, conector: Conector, contrato: dict,
                 tags: set[str] | None = None, direccion: str =
                 "bidireccional", nivel: str = "igual") -> None:
        v = validar_contrato_conexion(contrato)
        if not v.valido:
            raise ValueError(f"enchufe_rechazado:{nodo_id}:{v.errores}")
        if nodo_id in self.nodos:
            raise ValueError(f"nodo_duplicado:{nodo_id}")
        self.nodos[nodo_id] = NodoRed(nodo_id, conector, contrato,
                                      frozenset(tags or set()),
                                      direccion, nivel)
        self._ev("red.nodo_conectado", {"nodo": nodo_id, "nivel": nivel})

    def desconectar(self, nodo_id: str) -> None:
        self.nodos.pop(nodo_id, None)
        self._ev("red.nodo_desconectado", {"nodo": nodo_id})

    # ── RUTAS: el Director dibuja la red ──
    def ruta(self, ruta_id: str, origen: str, destino: str,
             cuando: str = "*", prioridad: int = 100,
             transformar: str = "") -> None:
        self.rutas.append(Ruta(ruta_id, origen, destino, cuando,
                               prioridad, True, transformar))
        self.rutas.sort(key=lambda r: r.prioridad)

    def _resolver(self, m: Mensaje) -> list[NodoRed]:
        """origen+tipo → rutas → nodos destino sanos y compatibles."""
        destinos: list[NodoRed] = []
        for r in self.rutas:
            if not r.activa:
                continue
            if not fnmatch.fnmatch(m.origen, r.origen):
                continue
            if not fnmatch.fnmatch(m.tipo, r.cuando):
                continue
            for nid, nodo in self.nodos.items():
                if (fnmatch.fnmatch(nid, r.destino) and nodo.sano
                        and nodo.direccion in ("entrada", "bidireccional")
                        and nodo not in destinos):
                    destinos.append(nodo)
        return destinos

    # ── ENVÍO: 1 mensaje → la red decide por las rutas declaradas ──
    async def enviar(self, m: Mensaje,
                     modo: str = "primero") -> dict:
        """modo: primero (failover) | todos (broadcast) | espejo (paralelo,
        gana el primero DONE)."""
        if not m.task_id:
            return {"status": "FAIL", "error": "task_id_obligatorio"}
        destinos = self._resolver(m)
        if not destinos:
            self._ev("red.sin_ruta", {"tipo": m.tipo, "origen": m.origen})
            return {"status": "FAIL", "error": f"sin_ruta:{m.origen}->{m.tipo}"}
        self._ev("red.envio", {"tipo": m.tipo, "origen": m.origen,
                               "destinos": [d.nodo_id for d in destinos],
                               "trace_id": m.trace_id})
        payload = {**m.payload, "task_id": m.task_id, "trace_id": m.trace_id}

        if modo == "todos":
            res = await asyncio.gather(
                *[self._enviar_a(d, payload) for d in destinos])
            return {"status": "DONE", "resultados": dict(
                zip([d.nodo_id for d in destinos], res))}

        if modo == "espejo":
            tareas = [asyncio.create_task(self._enviar_a(d, payload))
                      for d in destinos]
            for fut in asyncio.as_completed(tareas):
                r = await fut
                if r.get("status") == "DONE":
                    for t in tareas:
                        t.cancel()
                    return r
            return {"status": "FAIL", "error": "espejo_todos_fallaron"}

        for d in destinos:                        # modo "primero": failover
            r = await self._enviar_a(d, payload)
            if r.get("status") == "DONE":
                return {**r, "via": d.nodo_id}
        return {"status": "FAIL", "error": "todos_los_destinos_fallaron"}

    async def _enviar_a(self, nodo: NodoRed, payload: dict) -> dict:
        try:
            r = await nodo.conector.enviar(dict(payload))
            if r.get("status") == "DONE":
                nodo.fallos = 0
                return r
            raise RuntimeError(r.get("error", "fallo"))
        except Exception as exc:                   # noqa: BLE001
            nodo.fallos += 1
            if nodo.fallos >= self.MAX_FALLOS_NODO:
                nodo.sano = False
                self._ev("red.nodo_enfermo", {"nodo": nodo.nodo_id})
            return {"status": "FAIL", "error": str(exc),
                    "nodo": nodo.nodo_id}

    # ── SALUD + MAPA ──
    async def sondeo_loop(self, interval_s: int = 30) -> None:
        while True:
            await asyncio.sleep(interval_s)
            for n in self.nodos.values():
                try:
                    ok = await asyncio.wait_for(n.conector.sondear(), 10)
                    if ok and not n.sano:
                        n.sano, n.fallos = True, 0    # HALF_OPEN → CLOSED
                    elif not ok:
                        n.sano = False
                except Exception:                  # noqa: BLE001
                    n.sano = False

    def mapa(self) -> dict:
        """Foto de la red: para Studio/Telegram/atlas."""
        return {"nodos": {nid: {"sano": n.sano, "nivel": n.nivel,
                                "dir": n.direccion,
                                "dt_in": datatype_de(
                                    n.contrato["contrato"].get("consume")),
                                "dt_out": datatype_de(
                                    n.contrato["contrato"].get("expone"))}
                          for nid, n in self.nodos.items()},
                "rutas": [f"{r.origen} --[{r.cuando}]--> {r.destino}"
                          for r in self.rutas if r.activa]}

    def _ev(self, tipo: str, datos: dict) -> None:
        if self.audit:
            self.audit.evento(tipo, datos)

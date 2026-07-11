"""ENCHUFE GATE — aduana de la red. Ningún conector entra a la red sin
contrato v1.5 mínimo válido. Versión ligera del validador S7 (el completo
vive en repo 12; este gate usa el mismo schema).
"""
from __future__ import annotations
import re
from dataclasses import dataclass

RE_ARTIFACT = re.compile(r"^[a-z0-9_]+(\.[a-z0-9_]+)+$")
RE_HASH = re.compile(r"^sha256:[a-f0-9]{64}$")
KINDS = {"code", "llm", "db", "api", "tool"}
TRANSPORTS = {"stdio", "importlib", "http", "sdk", "prompt", "mcp"}
SANDBOX = {"container", "process", "none"}


@dataclass(frozen=True)
class VeredictoGate:
    valido: bool
    errores: tuple[str, ...] = ()


def validar_contrato_conexion(c: dict) -> VeredictoGate:
    """Chequeos duros antes de registrar un nodo en la red."""
    e: list[str] = []
    if not RE_ARTIFACT.match(c.get("artifact_id", "")):
        e.append("artifact_id_invalido")
    if c.get("estado") not in {"active", "testing"}:
        e.append(f"estado_no_conectable:{c.get('estado')}")
    if c.get("estado") == "active" and not RE_HASH.match(
            c.get("contract_hash", "")):
        e.append("active_requiere_hash_real")
    ej = c.get("ejecucion", {})
    if ej.get("kind") not in KINDS:
        e.append("kind_invalido")
    if ej.get("transport") not in TRANSPORTS:
        e.append("transport_invalido")
    seg = c.get("seguridad", {})
    if seg.get("sandbox") not in SANDBOX:
        e.append("sandbox_invalido")
    lim = seg.get("limites", {})
    if not (isinstance(lim.get("timeout_ms"), int) and lim["timeout_ms"] > 0):
        e.append("timeout_ms_requerido")
    if lim.get("deadline_ms", 0) < lim.get("timeout_ms", 1):
        e.append("deadline_menor_que_timeout")
    rol = c.get("contrato", {}).get("rol")
    if rol == "source" and c["contrato"].get("consume") is not None:
        e.append("source_no_consume")
    if rol == "sink" and c["contrato"].get("expone") is not None:
        e.append("sink_no_expone")
    if rol == "transform" and (not c["contrato"].get("consume")
                               or not c["contrato"].get("expone")):
        e.append("transform_requiere_ambos")
    return VeredictoGate(valido=not e, errores=tuple(e))


def datatype_de(io: dict | None) -> str:
    if not io:
        return ""
    dt = io.get("datatype", {})
    return f"{dt.get('family','')}.{dt.get('type','')}.v{dt.get('version',0)}"

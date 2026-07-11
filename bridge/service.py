"""
Repository Bridge Service
=========================

Capa intermedia entre GitHub y el Router Universal.

Arquitectura:
    GitHub (Skills + Docs + Memoria + DSL + Contracts)
        │
        ▼
    Repository Bridge Service (este archivo)
        │
        ├── Scanner      → escanea el repo y construye índices
        ├── Registry     → registro central de skills/docs/memoria
        ├── Sync         → sincroniza con GitHub (webhook + polling)
        ├── Cache        → copia local en VPS (funciona offline)
        └── API interna  → el Router consulta SOLO esta API

El Router NUNCA lee GitHub directamente. Solo consulta el Bridge.
Si mañana cambias GitHub por otro origen (GitLab, S3, disco local), el
Router no se entera. El contrato es siempre el mismo.

Endpoints del Bridge:
    GET  /bridge/health
    GET  /bridge/registry
    GET  /bridge/skills
    GET  /bridge/skills/<name>
    GET  /bridge/docs
    GET  /bridge/docs/<path>
    GET  /bridge/memory
    GET  /bridge/memory/<path>
    GET  /bridge/dsl
    GET  /bridge/contracts
    POST /bridge/sync                      (engineer)
    POST /bridge/sync/webhook              (GitHub webhook)
    POST /bridge/cache/warm                (engineer)
    GET  /bridge/cache/status
    GET  /bridge/stats
"""

import os
import json
import time
import asyncio
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from threading import Lock

logger = logging.getLogger("bridge")

# =====================================================================
# CONFIGURACIÓN
# =====================================================================

GITHUB_API = "https://api.github.com"
GITHUB_REPO = "maxbry123-commits/maxbry-router"
GITHUB_BRANCH = "main"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "ghp_REDACTED")

# Directorio de cache local
BRIDGE_DIR = Path(os.environ.get("BRIDGE_DIR", "/opt/nct/bridge"))
CACHE_DIR = BRIDGE_DIR / "cache"
INDEX_DIR = BRIDGE_DIR / "index"
SYNC_LOG = BRIDGE_DIR / "sync.log"
STATS_FILE = BRIDGE_DIR / "stats.json"

# Categorías que el Bridge escanea
CATEGORIES = ["skills", "docs", "memory", "dsl", "contracts"]

# =====================================================================
# DATA CLASSES
# =====================================================================

@dataclass
class IndexEntry:
    name: str
    path: str
    version: str = "1.0.0"
    state: str = "active"  # active | warning | error | offline
    size_bytes: int = 0
    sha: str = ""
    last_modified: str = ""
    source: str = "github"  # github | cache | memory
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)

@dataclass
class BridgeStats:
    total_skills: int = 0
    total_docs: int = 0
    total_memory: int = 0
    total_dsl: int = 0
    total_contracts: int = 0
    last_sync: str = ""
    last_sync_status: str = "never"
    cache_size_bytes: int = 0
    github_connected: bool = False
    sync_count: int = 0
    errors: int = 0

# =====================================================================
# SCANNER — escanea el repo y construye índices
# =====================================================================

class RepositoryScanner:
    """Escanea un repo (GitHub o local) y construye índices de skills/docs/memoria."""

    def __init__(self, source: str = "github"):
        self.source = source
        self.github_token = GITHUB_TOKEN

    def scan(self) -> Dict[str, List[IndexEntry]]:
        """Escanea el repo y devuelve índices por categoría."""
        if self.source == "github":
            return self._scan_github()
        elif self.source == "local":
            return self._scan_local()
        elif self.source == "cache":
            return self._scan_cache()
        else:
            raise ValueError(f"unknown source: {self.source}")

    def _scan_github(self) -> Dict[str, List[IndexEntry]]:
        """Escanea GitHub vía API."""
        import urllib.request
        import urllib.error

        indices: Dict[str, List[IndexEntry]] = {c: [] for c in CATEGORIES}

        def fetch(path: str) -> List[dict]:
            url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{path}?ref={GITHUB_BRANCH}"
            req = urllib.request.Request(url, headers={
                "Authorization": f"token {self.github_token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "MAXBRY-Bridge/1.0"
            })
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    return json.loads(r.read())
            except Exception as e:
                logger.warning(f"bridge: error fetching {path}: {e}")
                return []

        for cat in CATEGORIES:
            items = fetch(cat)
            for item in items:
                if item.get("type") == "dir":
                    sub = fetch(f"{cat}/{item['name']}")
                    for s in sub:
                        if s.get("type") == "file" and s["name"] in ("manifest.json", "README.md", "*.yaml", "*.md"):
                            indices[cat].append(IndexEntry(
                                name=item["name"],
                                path=s["path"],
                                sha=s.get("sha", ""),
                                size_bytes=s.get("size", 0),
                                last_modified=datetime.utcnow().isoformat(),
                                source="github",
                                meta={"download_url": s.get("download_url", "")}
                            ))
                elif item.get("type") == "file":
                    indices[cat].append(IndexEntry(
                        name=item["name"],
                        path=item["path"],
                        sha=item.get("sha", ""),
                        size_bytes=item.get("size", 0),
                        last_modified=datetime.utcnow().isoformat(),
                        source="github",
                        meta={"download_url": item.get("download_url", "")}
                    ))
        return indices

    def _scan_local(self) -> Dict[str, List[IndexEntry]]:
        """Escanea un directorio local (modo test)."""
        indices: Dict[str, List[IndexEntry]] = {c: [] for c in CATEGORIES}
        base = Path("/workspace/MAXBRY-ROUTER")
        for cat in CATEGORIES:
            cat_dir = base / cat
            if not cat_dir.exists(): continue
            for p in cat_dir.rglob("*.md"):
                indices[cat].append(IndexEntry(
                    name=p.stem,
                    path=str(p.relative_to(base)),
                    size_bytes=p.stat().st_size,
                    last_modified=datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                    source="local"
                ))
            for p in cat_dir.rglob("*.json"):
                indices[cat].append(IndexEntry(
                    name=p.stem,
                    path=str(p.relative_to(base)),
                    size_bytes=p.stat().st_size,
                    last_modified=datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                    source="local"
                ))
        return indices

    def _scan_cache(self) -> Dict[str, List[IndexEntry]]:
        """Lee el cache local."""
        indices: Dict[str, List[IndexEntry]] = {c: [] for c in CATEGORIES}
        if not INDEX_DIR.exists(): return indices
        for cat in CATEGORIES:
            cat_dir = INDEX_DIR / cat
            if not cat_dir.exists(): continue
            for f in cat_dir.glob("*.json"):
                try:
                    data = json.loads(f.read_text())
                    indices[cat].append(IndexEntry(**data))
                except Exception as e:
                    logger.warning(f"bridge: error reading {f}: {e}")
        return indices

# =====================================================================
# REGISTRY — registro central
# =====================================================================

class Registry:
    """Registro central de skills/docs/memoria. El Router consulta ESTE registro."""

    def __init__(self, indices: Dict[str, List[IndexEntry]]):
        self.indices = indices
        self.lock = Lock()
        self._build_lookup()

    def _build_lookup(self):
        self.lookup: Dict[str, IndexEntry] = {}
        for cat, entries in self.indices.items():
            for e in entries:
                self.lookup[f"{cat}/{e.name}"] = e

    def get(self, category: str, name: str) -> Optional[IndexEntry]:
        return self.lookup.get(f"{category}/{name}")

    def list(self, category: str) -> List[IndexEntry]:
        return self.indices.get(category, [])

    def all(self) -> Dict[str, List[IndexEntry]]:
        return self.indices

    def update(self, indices: Dict[str, List[IndexEntry]]):
        with self.lock:
            self.indices = indices
            self._build_lookup()

# =====================================================================
# CACHE — copia local en VPS
# =====================================================================

class Cache:
    """Caché local en /opt/nct/bridge/cache/. Permite que el sistema funcione offline."""

    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._hits = 0
        self._misses = 0

    def get(self, path: str) -> Optional[bytes]:
        """Lee del cache. Si no existe, devuelve None."""
        safe_path = path.replace("/", "_").replace("..", "_")
        f = self.cache_dir / safe_path
        if f.exists():
            self._hits += 1
            return f.read_bytes()
        self._misses += 1
        return None

    def put(self, path: str, content: bytes) -> str:
        """Guarda en cache. Devuelve hash SHA-256."""
        h = hashlib.sha256(content).hexdigest()
        safe_path = path.replace("/", "_").replace("..", "_")
        f = self.cache_dir / safe_path
        f.write_bytes(content)
        # metadata
        meta = f.with_suffix(".meta.json")
        meta.write_text(json.dumps({
            "path": path, "sha256": h, "size": len(content),
            "cached_at": datetime.utcnow().isoformat()
        }))
        return h

    def warm(self, indices: Dict[str, List[IndexEntry]]):
        """Pre-carga el cache con los archivos del registry."""
        for cat, entries in indices.items():
            for e in entries:
                if e.meta.get("download_url"):
                    self._fetch_to_cache(e.path, e.meta["download_url"])

    def _fetch_to_cache(self, path: str, url: str):
        try:
            import urllib.request
            req = urllib.request.Request(url, headers={"User-Agent": "MAXBRY-Bridge/1.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                self.put(path, r.read())
        except Exception as e:
            logger.warning(f"bridge: cache warm failed for {path}: {e}")

    def size_bytes(self) -> int:
        total = 0
        for f in self.cache_dir.rglob("*"):
            if f.is_file(): total += f.stat().st_size
        return total

    def status(self) -> dict:
        return {
            "hits": self._hits,
            "misses": self._misses,
            "size_bytes": self.size_bytes(),
            "files": len(list(self.cache_dir.rglob("*")))
        }

# =====================================================================
# SYNC — sincronización con GitHub (webhook + polling)
# =====================================================================

class SyncManager:
    """Sincroniza el bridge con el origen (GitHub / local)."""

    def __init__(self, scanner: RepositoryScanner, registry: Registry, cache: Cache, stats: BridgeStats):
        self.scanner = scanner
        self.registry = registry
        self.cache = cache
        self.stats = stats
        self.last_event: Optional[dict] = None

    async def sync(self, source: Optional[str] = None) -> dict:
        """Sincroniza. Si GitHub falla, fallback al cache local."""
        src = source or self.scanner.source
        started = time.time()
        try:
            # Intentar GitHub
            if src == "github":
                indices = await self._sync_github()
            else:
                indices = self.scanner._scan_local() if src == "local" else self.scanner._scan_cache()

            self.registry.update(indices)
            self.cache.warm(indices)
            self._save_index(indices)
            self.stats.last_sync = datetime.utcnow().isoformat()
            self.stats.last_sync_status = "ok"
            self.stats.github_connected = (src == "github")
            self.stats.sync_count += 1
            self._update_stats()
            return {
                "status": "ok",
                "source": src,
                "duration_ms": int((time.time() - started) * 1000),
                "total": sum(len(v) for v in indices.values()),
                "by_category": {k: len(v) for k, v in indices.items()}
            }
        except Exception as e:
            self.stats.errors += 1
            self.stats.last_sync_status = f"error: {e}"
            self._update_stats()
            # Fallback al cache
            cache_indices = self.scanner._scan_cache()
            if any(cache_indices.values()):
                self.registry.update(cache_indices)
                return {
                    "status": "fallback_cache",
                    "error": str(e),
                    "source": "cache",
                    "duration_ms": int((time.time() - started) * 1000)
                }
            return {"status": "error", "error": str(e)}

    async def _sync_github(self) -> Dict[str, List[IndexEntry]]:
        """Llama al scanner de GitHub en un thread (no bloquea el event loop)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.scanner._scan_github)

    def on_webhook(self, payload: dict) -> dict:
        """Recibe un webhook de GitHub y dispara un sync."""
        self.last_event = {
            "type": "webhook",
            "event": payload.get("ref", ""),
            "commits": len(payload.get("commits", [])),
            "pusher": payload.get("pusher", {}).get("name", ""),
            "received_at": datetime.utcnow().isoformat()
        }
        # Async sync
        asyncio.create_task(self.sync())
        return self.last_event

    def _save_index(self, indices: Dict[str, List[IndexEntry]]):
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        for cat, entries in indices.items():
            cat_dir = INDEX_DIR / cat
            cat_dir.mkdir(parents=True, exist_ok=True)
            for e in entries:
                f = cat_dir / f"{e.name}.json"
                f.write_text(json.dumps(e.to_dict(), indent=2))

    def _update_stats(self):
        try:
            STATS_FILE.write_text(json.dumps(asdict(self.stats), indent=2))
        except: pass

# =====================================================================
# BRIDGE SERVICE — punto de entrada único
# =====================================================================

class BridgeService:
    """El servicio Bridge completo."""

    def __init__(self, source: str = "github"):
        BRIDGE_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.scanner = RepositoryScanner(source=source)
        self.cache = Cache()
        self.stats = BridgeStats()
        # Inicializar registry con cache o escaneo
        initial = self.scanner._scan_cache() if INDEX_DIR.exists() else {c: [] for c in CATEGORIES}
        self.registry = Registry(initial)
        self.sync_manager = SyncManager(self.scanner, self.registry, self.cache, self.stats)
        self.last_webhook: Optional[dict] = None

    async def sync(self) -> dict:
        return await self.sync_manager.sync()

    def get_skill(self, name: str) -> Optional[dict]:
        e = self.registry.get("skills", name)
        return e.to_dict() if e else None

    def list_skills(self) -> List[dict]:
        return [e.to_dict() for e in self.registry.list("skills")]

    def get_doc(self, path: str) -> Optional[dict]:
        for e in self.registry.list("docs"):
            if e.path.endswith(path) or e.name == path:
                return e.to_dict()
        return None

    def list_docs(self) -> List[dict]:
        return [e.to_dict() for e in self.registry.list("docs")]

    def get_memory(self, path: str) -> Optional[dict]:
        for e in self.registry.list("memory"):
            if e.path.endswith(path) or e.name == path:
                return e.to_dict()
        return None

    def list_memory(self) -> List[dict]:
        return [e.to_dict() for e in self.registry.list("memory")]

    def get_file_content(self, path: str) -> Optional[bytes]:
        """Lee un archivo: cache → GitHub → 404."""
        cached = self.cache.get(path)
        if cached: return cached
        # Buscar en registry para re-descargar
        for cat in CATEGORIES:
            for e in self.registry.list(cat):
                if e.path == path and e.meta.get("download_url"):
                    try:
                        import urllib.request
                        req = urllib.request.Request(e.meta["download_url"], headers={"User-Agent": "MAXBRY-Bridge/1.0"})
                        with urllib.request.urlopen(req, timeout=10) as r:
                            content = r.read()
                            self.cache.put(path, content)
                            return content
                    except: pass
        return None

    def status(self) -> dict:
        return {
            "github_connected": self.stats.github_connected,
            "last_sync": self.stats.last_sync,
            "last_sync_status": self.stats.last_sync_status,
            "sync_count": self.stats.sync_count,
            "errors": self.stats.errors,
            "cache": self.cache.status(),
            "totals": {
                "skills": len(self.registry.list("skills")),
                "docs": len(self.registry.list("docs")),
                "memory": len(self.registry.list("memory")),
                "dsl": len(self.registry.list("dsl")),
                "contracts": len(self.registry.list("contracts"))
            }
        }

# =====================================================================
# SINGLETON + API ENDPOINTS (FastAPI)
# =====================================================================

_bridge: Optional[BridgeService] = None

def get_bridge() -> BridgeService:
    global _bridge
    if _bridge is None:
        _bridge = BridgeService(source="github")
    return _bridge

def register_bridge_routes(app):
    """Registra los endpoints /bridge/* en una app FastAPI."""
    from fastapi import APIRouter, Request, HTTPException, Header
    router = APIRouter(prefix="/bridge", tags=["bridge"])

    @router.get("/health")
    async def health():
        b = get_bridge()
        return {
            "status": "ok",
            "github_connected": b.stats.github_connected,
            "last_sync": b.stats.last_sync,
            "totals": b.status()["totals"]
        }

    @router.get("/stats")
    async def stats():
        return get_bridge().status()

    @router.get("/registry")
    async def registry():
        b = get_bridge()
        return b.registry.all()

    @router.get("/skills")
    async def list_skills():
        return {"skills": get_bridge().list_skills(), "count": len(get_bridge().list_skills())}

    @router.get("/skills/{name}")
    async def get_skill(name: str):
        s = get_bridge().get_skill(name)
        if not s: raise HTTPException(404, f"skill '{name}' not found")
        return s

    @router.get("/docs")
    async def list_docs():
        return {"docs": get_bridge().list_docs(), "count": len(get_bridge().list_docs())}

    @router.get("/docs/{path:path}")
    async def get_doc(path: str):
        d = get_bridge().get_doc(path)
        if not d: raise HTTPException(404, f"doc '{path}' not found")
        return d

    @router.get("/memory")
    async def list_memory():
        return {"memory": get_bridge().list_memory(), "count": len(get_bridge().list_memory())}

    @router.get("/memory/{path:path}")
    async def get_memory(path: str):
        m = get_bridge().get_memory(path)
        if not m: raise HTTPException(404, f"memory '{path}' not found")
        return m

    @router.get("/file/{path:path}")
    async def get_file(path: str):
        content = get_bridge().get_file_content(path)
        if not content: raise HTTPException(404, f"file '{path}' not found")
        return {"path": path, "size": len(content), "content": content.decode("utf-8", errors="replace")[:50000]}

    @router.post("/sync")
    async def sync(x_role: str = Header(default="guest")):
        if x_role not in ("engineer", "operador"):
            raise HTTPException(403, "engineer or operador required")
        b = get_bridge()
        result = await b.sync()
        return result

    @router.post("/sync/webhook")
    async def webhook(request: Request):
        """Recibe webhooks de GitHub."""
        try:
            payload = await request.json()
        except:
            raise HTTPException(400, "invalid json")
        b = get_bridge()
        result = b.sync_manager.on_webhook(payload)
        return {"received": True, "triggered": result}

    @router.post("/cache/warm")
    async def cache_warm(x_role: str = Header(default="guest")):
        if x_role not in ("engineer", "operador"):
            raise HTTPException(403, "engineer or operador required")
        b = get_bridge()
        b.cache.warm(b.registry.all())
        return {"warmed": True, "cache_size": b.cache.size_bytes()}

    @router.get("/cache/status")
    async def cache_status():
        return get_bridge().cache.status()

    @router.get("/dsl")
    async def list_dsl():
        return {"dsl": [e.to_dict() for e in get_bridge().registry.list("dsl")]}

    @router.get("/contracts")
    async def list_contracts():
        return {"contracts": [e.to_dict() for e in get_bridge().registry.list("contracts")]}

    app.include_router(router)
    return router

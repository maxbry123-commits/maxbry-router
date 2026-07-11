# 🌉 Repository Bridge Service

Capa intermedia entre **GitHub** y el **Router Universal**.

## Arquitectura

```
GitHub (maxbry123-commits/maxbry-router)
    ├── /skills
    ├── /docs
    ├── /memory
    ├── /dsl
    └── /contracts
            │
            ▼
   Repository Bridge Service
            │
   ┌────────┼─────────┐
   ▼        ▼         ▼
 Scanner  Registry  Cache
            │
            ▼
      Router Universal
            │
            ▼
    Agentes / HF / VPS
```

## Componentes

| Componente | Función |
|------------|---------|
| **Scanner** | Escanea el repo (GitHub o local) y construye índices |
| **Registry** | Registro central: `GET /skills/planner` |
| **Sync** | Sincroniza con GitHub (webhook + polling) |
| **Cache** | Copia local en VPS — funciona offline |
| **API interna** | El Router consulta SOLO esta API |

## Endpoints

### Para el frontend (consumibles directamente)
- `GET  /api/bridge/health` — estado del bridge
- `GET  /api/bridge/skills` — lista de skills del repo
- `GET  /api/bridge/skills/{name}` — detalle de un skill
- `GET  /api/bridge/docs` — documentos indexados
- `GET  /api/bridge/memory` — entradas de memoria indexadas
- `GET  /api/bridge/registry` — registro completo
- `POST /api/bridge/sync` — sincronizar (engineer/operador)
- `GET  /api/bridge/cache/status` — estado del cache
- `POST /api/bridge/cache/warm` — pre-cargar cache (engineer/operador)

### Internos del Bridge
- `GET  /bridge/health`
- `GET  /bridge/stats`
- `GET  /bridge/registry`
- `GET  /bridge/skills`
- `GET  /bridge/skills/{name}`
- `GET  /bridge/docs`
- `GET  /bridge/docs/{path}`
- `GET  /bridge/memory`
- `GET  /bridge/memory/{path}`
- `GET  /bridge/file/{path}` — contenido del archivo
- `POST /bridge/sync`
- `POST /bridge/sync/webhook` — GitHub webhook
- `POST /bridge/cache/warm`
- `GET  /bridge/cache/status`
- `GET  /bridge/dsl`
- `GET  /bridge/contracts`

## Configuración

Variables de entorno (con defaults):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `GITHUB_TOKEN` | `ghp_...` | Token para la API de GitHub |
| `GITHUB_REPO` | `maxbry123-commits/maxbry-router` | Repo a sincronizar |
| `GITHUB_BRANCH` | `main` | Branch |
| `BRIDGE_DIR` | `/opt/nct/bridge` | Directorio del cache/índices |

## Auto-sync al arrancar

El Router llama `bridge.sync()` en su `startup` event.
Si GitHub falla → fallback automático al cache local.

## Webhook de GitHub

Configurar en GitHub → Settings → Webhooks:
- URL: `https://<router>/bridge/sync/webhook`
- Events: `push`, `pull_request`

## Flujo

1. **Push a GitHub** → webhook llega al Bridge
2. **Bridge detecta cambios** → re-escanea
3. **Actualiza registry + cache** → sin reiniciar el Router
4. **Notifica via WebSocket** → el frontend ve el cambio

## Por qué desacoplar

Si mañana cambias GitHub por GitLab, S3, disco local o un NAS,
**el Router no se entera**. El contrato es siempre el mismo:
`GET /api/bridge/skills/<name>` devuelve la misma estructura.

## Pruebas

```bash
# 1. Health
curl http://localhost:8000/api/bridge/health

# 2. Listar skills
curl http://localhost:8000/api/bridge/skills

# 3. Sincronizar
curl -X POST http://localhost:8000/api/bridge/sync -H "X-Role: engineer"

# 4. Ver cache
curl http://localhost:8000/api/bridge/cache/status
```

---

**Versión**: 1.0.0 · **Router**: MAXBRY v3.0 · **Parche**: v5.3

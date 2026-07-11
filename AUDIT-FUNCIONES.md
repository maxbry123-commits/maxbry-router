# AUDITORÍA FUNCIONES · ROUTER MAXBRY vs DOCUMENTO

## Funciones del DOCUMENTO (ROUTER_UNIVERSAL_RED_CONEXIONES.md + ROUTER-INTERFACE.md)

| # | Función del doc | Endpoint que debería tener | Mi app.py tiene? | Test real? |
|---|----------------|---------------------------|------------------|------------|
| 1 | `RedUniversal.conectar(nodo, conector, contrato)` | POST /api/red/connect | ✅ | ❌ |
| 2 | `RedUniversal.desconectar(nodo)` | POST /api/red/disconnect | ✅ | ❌ |
| 3 | `RedUniversal.ruta(ruta_id, origen, destino, cuando, prioridad)` | POST /api/red/route | ✅ | ❌ |
| 4 | `RedUniversal.enviar(mensaje, modo)` con task_id | POST /api/red/send | ✅ | ❌ |
| 5 | Modo `primero` (failover) | parámetro | ✅ | ❌ |
| 6 | Modo `todos` (broadcast) | parámetro | ✅ | ❌ |
| 7 | Modo `espejo` (paralelo, gana primero) | parámetro | ✅ | ❌ |
| 8 | `RedUniversal.mapa()` | GET /api/red/mapa | ✅ | ❌ |
| 9 | `RedUniversal.sondeo_loop(interval_s)` | background task | ❌ | ❌ |
| 10 | `ConectorHTTP.enviar(payload)` | NVIDIA NIM, OpenAI | ✅ | ❌ |
| 11 | `ConectorHTTP.sondear()` | health check | ✅ | ❌ |
| 12 | `ConectorMCP.enviar()` JSON-RPC | POST /api/mcp/invoke | ✅ | ❌ |
| 13 | `ConectorGitHub.enviar()` get_file | POST /api/github/file | ✅ | ❌ |
| 14 | `ConectorGitHub.enviar()` create_issue | POST /api/github/issue | ✅ | ❌ |
| 15 | `ConectorGitHub.enviar()` create_pr | ❌ falta | ❌ | ❌ |
| 16 | `ConectorGitHub.enviar()` commit_file | POST /api/github/commit | ✅ | ❌ |
| 17 | `ConectorGitHub.enviar()` dispatch workflow | POST /api/github/dispatch | ✅ | ❌ |
| 18 | `ConectorVPS.enviar()` con whitelist (status, deploy, restart, logs, run_script) | POST /api/vps/exec | ✅ | ❌ |
| 19 | `ConectorMemoria.enviar()` op=leer/commit/snapshot | POST /api/memory/* | ✅ | ❌ |
| 20 | `ConectorInterno.enviar()` async handler | agentes claude/mimo/openclaw | ✅ | ❌ |
| 21 | `ConectorWebhook.enviar()` Telegram | POST /api/telegram/notify | ✅ | ❌ |
| 22 | `validar_contrato_conexion()` enchufe gate | en cada conectar | ✅ | ❌ |

## Funciones del ROUTER-INTERFACE.md (16 nodos FSM)

| # | Nodo | Endpoint | Mi app.py |
|---|------|----------|-----------|
| 1 | NODO-01 command_center | GET /api/nodos/1 | ❌ falta |
| 2 | NODO-02 work_order_queue | GET /api/nodos/2 | ❌ falta |
| 3 | NODO-03 parser_view | GET /api/nodos/3 | ❌ falta |
| 4 | NODO-04 validator_view | GET /api/nodos/4 | ❌ falta |
| 5 | NODO-05 dag_visualizer | GET /api/nodos/5 | ❌ falta |
| 6 | NODO-06 scheduler_view | GET /api/nodos/6 | ❌ falta |
| 7 | NODO-07 executor_monitor | GET /api/nodos/7 | ❌ falta |
| 8 | NODO-08 sandbox_status | GET /api/nodos/8 | ❌ falta |
| 9 | NODO-09 git_status | GET /api/nodos/9 | ❌ falta |
| 10 | NODO-10 consensus_view | GET /api/nodos/10 | ❌ falta |
| 11 | NODO-11 artifact_viewer | GET /api/nodos/11 | ❌ falta |
| 12 | NODO-12 audit_report | GET /api/nodos/12 | ❌ falta |
| 13 | NODO-13 pr_preview | GET /api/nodos/13 | ❌ falta |
| 14 | NODO-14 cost_tracker | GET /api/nodos/14 | ❌ falta |
| 15 | NODO-15 state_machine | GET /api/nodos/15 | ❌ falta |
| 16 | NODO-16 error_panel | GET /api/nodos/16 | ❌ falta |
| 17 | GET /api/nodos (lista 16) | ❌ falta |
| 18 | GET /api/fichas | ❌ falta |
| 19 | POST /api/fichas | ❌ falta |
| 20 | GET /api/fichas/{id} | ❌ falta |
| 21 | GET /api/fichas/{id}/estado | ❌ falta |
| 22 | GET /api/fichas/{id}/log | ❌ falta |
| 23 | POST /api/fichas/{id}/cancel | ❌ falta |
| 24 | POST /api/fichas/{id}/retry | ❌ falta |
| 25 | WS /ws/fichas/{id} | ❌ falta |
| 26 | POST /run (Runtime) | ❌ falta |
| 27 | POST /run-and-deliver | ❌ falta |
| 28 | POST /execute | ❌ falta |
| 29 | GET /health (Runtime) | ✅ |
| 30 | Bloque A-G de ficha | ❌ falta |

## Resumen honesto

- **22 funciones del router doc**: 18 endpoints ✅, 4 faltantes (sondeo_loop, create_pr, más auditoría)
- **30 funciones de ROUTER-INTERFACE.md**: 0 endpoints ✅, 30 faltantes
- **Total**: 18/52 (35%) de las funciones implementadas, 0/52 probadas con test real

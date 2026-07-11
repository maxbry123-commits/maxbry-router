# 📂 MAXBRY · Router Skills v5.3 — Parche Unificado

> **30 Skills + Marketplace + Builder Studio + Schema Builder + Component Builder**
>
> Este archivo es el **manifiesto vivo** del Router. Define qué sabe hacer,
> cómo se instala cada skill, cómo se crean componentes visuales sin tocar
> código, y cómo extender el Router sin modificar el núcleo.
>
> **Arquitectura:** código del Router en GitHub (`maxbry123-commits/maxbry-router`)
> →  cerebro+memoria en VPS `95.111.232.89`  →  ejecución en HF / Railway / Docker
>
> **Reglas duras (no negociables):**
> - Ningún skill hardcodea credenciales. Las lee del `SecretsManager`.
> - Ningún skill ejecuta código sin `sandbox` cuando es nivel 2+.
> - Todo skill tiene: `name`, `version`, `category`, `inputs`, `outputs`, `permissions`, `events`, `health_check`, `manifest.json`, `handler.py`.
> - El Router NO se rompe si un skill falla. Aislamiento total.
> - Marketplace lee skills desde GitHub, NO desde npm ni PyPI.

---

## 0 · Tabla de contenidos

1. [Las 30 skills del Router](#1-las-30-skills-del-router)
2. [Anatomía de un skill](#2-anatomía-de-un-skill)
3. [Skill Marketplace](#3-skill-marketplace)
4. [Builder Studio (crear componentes sin código)](#4-builder-studio)
5. [Schema Builder (formularios auto-generados)](#5-schema-builder)
6. [Component Builder (paneles dinámicos)](#6-component-builder)
7. [Sistema de almacenamiento (`/custom-panels/`)](#7-sistema-de-almacenamiento)
8. [Endpoints REST del Router para skills](#8-endpoints-rest-del-router-para-skills)
9. [WebSocket events del Router](#9-websocket-events-del-router)
10. [Permisos y niveles](#10-permisos-y-niveles)
11. [Catálogo completo de skills](#11-catálogo-completo-de-skills)

---

## 1 · Las 30 skills del Router

```
🧠 Inteligencia          🔧 Infraestructura       📚 Conocimiento
 1. Auto Router            6. Auto Recovery         11. Auto RAG
 2. Consensus              7. Health Monitor        12. Document Mount
 3. Refutation             8. Latency Optimizer     13. Context Builder
 4. Planner                9. Cost Optimizer
 5. Critic                10. Load Balancer

🤖 Agentes               🛡️ Seguridad              🚀 Productividad
14. Role Manager          17. Secrets Manager       20. One Click Deploy
15. Memory Sync           18. Permission Manager    21. Backup Manager
16. Skill Loader          19. Audit Trail           22. Version Manager
                                                    23. Template Manager
                                                    24. Workflow Library

🎨 Interfaz
25. Configuration Assistant
26. Connection Wizard
27. Visual DSL Builder
28. Flow Inspector
29. Quick Actions
30. Layout Manager
```

---

## 2 · Anatomía de un skill

Todo skill se entrega como un **directorio autocontenido** con esta estructura:

```
/opt/nct/skills/<categoria>/<skill_name>/
├── manifest.json          ← metadata + permisos + eventos
├── handler.py             ← lógica principal (async, no bloqueante)
├── schema.yaml            ← campos del formulario (auto-genera UI)
├── tests/
│   ├── test_unit.py
│   └── test_integration.py
├── README.md              ← qué hace, ejemplos, troubleshooting
└── config.example.yaml
```

### 2.1 · `manifest.json` (obligatorio)

```json
{
  "name": "consensus",
  "version": "1.0.0",
  "category": "intelligence",
  "level": 2,
  "author": "max@maxbry-router.dev",
  "repo": "https://github.com/maxbry123-commits/maxbry-router/tree/main/skills/intelligence/consensus",
  "icon": "⚖",
  "color": "var(--purple)",
  "description": "Consulta varios modelos y genera consenso por voto",
  "tags": ["reasoning", "voting", "multi-model"],
  "permissions": [
    "use_api",
    "use_memory",
    "use_github"
  ],
  "inputs": [
    { "name": "prompt", "type": "string", "required": true, "max": 8000 },
    { "name": "models", "type": "array", "default": ["claude", "mimo", "openclaw"], "min": 2, "max": 5 },
    { "name": "threshold", "type": "number", "default": 0.66, "min": 0, "max": 1 }
  ],
  "outputs": [
    { "name": "consensus", "type": "string" },
    { "name": "votes", "type": "array" },
    { "name": "confidence", "type": "number" }
  ],
  "events": [
    "on_skill_install",
    "on_skill_uninstall",
    "on_skill_error",
    "on_consensus_reached"
  ],
  "health_check": {
    "endpoint": "/api/skills/consensus/health",
    "interval_s": 60
  },
  "dependencies": ["router-core>=1.0"],
  "sandbox": true,
  "timeout_ms": 60000
}
```

### 2.2 · `handler.py` (obligatorio)

```python
from router.core.skill import Skill, skill
from typing import Any

@skill(name="consensus", version="1.0.0")
class ConsensusSkill:
    """Consulta N modelos y devuelve la respuesta por consenso."""

    async def on_install(self):
        # Validar permisos, recursos, modelos disponibles
        await self.validate_models()
        return {"installed": True, "models": self.config["models"]}

    async def on_uninstall(self):
        # Limpiar caches, conexiones, timers
        return {"uninstalled": True}

    async def run(self, prompt: str, models: list[str], threshold: float = 0.66) -> dict:
        """Ejecuta el skill."""
        votes = []
        for model in models:
            response = await self.router.call_model(model, prompt)
            votes.append({"model": model, "response": response})
        consensus = self._vote(votes, threshold)
        return {"consensus": consensus, "votes": votes, "confidence": len(votes) / len(models)}

    async def on_health_check(self) -> dict:
        return {"healthy": True, "models_online": await self._check_models()}

    def _vote(self, votes, threshold):
        # Lógica de consenso (mayoría simple, ponderada, semántica)
        ...
```

### 2.3 · `schema.yaml` (formulario auto-generado)

```yaml
name: consensus
display_name: "⚖ Consensus"
category: intelligence
description: "Consulta varios modelos y vota"
fields:
  - name: models
    label: "Modelos a consultar"
    type: multi_select
    options: [claude, mimo, openclaw]
    default: [claude, mimo]
    required: true
  - name: threshold
    label: "Umbral de consenso"
    type: slider
    min: 0.5
    max: 1.0
    default: 0.66
  - name: voting_method
    label: "Método de votación"
    type: select
    options: [mayoria_simple, ponderada, semantica]
    default: ponderada
permissions:
  - use_api
  - use_memory
```

---

## 3 · Skill Marketplace

### 3.1 · Concepto

El Router descubre skills desde:
1. **Directorio local** `/opt/nct/skills/<cat>/<name>/`
2. **Repositorio GitHub** `maxbry123-commits/maxbry-router/tree/main/skills/`
3. **Repos externos** registrados en `marketplace.sources.yaml`

### 3.2 · Catálogo actual del marketplace (30 skills)

| ⭐ | Skill | Categoría | Versión | Estado |
|---|-------|-----------|---------|--------|
| ⭐ | Auto Router | intelligence | 1.0 | ✅ estable |
| ⭐ | Consensus | intelligence | 1.0 | ✅ estable |
| ⭐ | Refutation | intelligence | 1.0 | ✅ estable |
| ⭐ | Planner | intelligence | 1.0 | ✅ estable |
| ⭐ | Critic | intelligence | 1.0 | ✅ estable |
| ⭐ | Auto Recovery | infra | 1.0 | ✅ estable |
| ⭐ | Health Monitor | infra | 1.0 | ✅ estable |
| ⭐ | Latency Optimizer | infra | 1.0 | ✅ estable |
| ⭐ | Cost Optimizer | infra | 1.0 | ✅ estable |
| ⭐ | Load Balancer | infra | 1.0 | ✅ estable |
| ⭐ | Auto RAG | knowledge | 1.0 | ✅ estable |
| ⭐ | Document Mount | knowledge | 1.0 | ✅ estable |
| ⭐ | Context Builder | knowledge | 1.0 | ✅ estable |
| ⭐ | Role Manager | agents | 1.0 | ✅ estable |
| ⭐ | Memory Sync | agents | 1.0 | ✅ estable |
| ⭐ | Skill Loader | agents | 1.0 | ✅ estable |
| ⭐ | Secrets Manager | security | 1.0 | ✅ estable |
| ⭐ | Permission Manager | security | 1.0 | ✅ estable |
| ⭐ | Audit Trail | security | 1.0 | ✅ estable |
| ⭐ | One Click Deploy | productivity | 1.0 | ✅ estable |
| ⭐ | Backup Manager | productivity | 1.0 | ✅ estable |
| ⭐ | Version Manager | productivity | 1.0 | ✅ estable |
| ⭐ | Template Manager | productivity | 1.0 | ✅ estable |
| ⭐ | Workflow Library | productivity | 1.0 | ✅ estable |
| ⭐ | Configuration Assistant | ui | 1.0 | ✅ estable |
| ⭐ | Connection Wizard | ui | 1.0 | ✅ estable |
| ⭐ | Visual DSL Builder | ui | 1.0 | ✅ estable |
| ⭐ | Flow Inspector | ui | 1.0 | ✅ estable |
| ⭐ | Quick Actions | ui | 1.0 | ✅ estable |
| ⭐ | Layout Manager | ui | 1.0 | ✅ estable |

### 3.3 · Instalación

**Desde la interfaz (UI):**
- Panel 1 → Recursos → categoría `Skills`
- Click en el skill → botón `[Instalar]`
- Verificación: requirements, permisos, health check
- Aceptar permisos solicitados
- Aparece toast `✓ consensus instalado`

**Desde API (engineer level):**
```bash
POST /api/skills/install
{
  "name": "consensus",
  "source": "github",
  "repo": "maxbry123-commits/maxbry-router",
  "path": "skills/intelligence/consensus"
}
```

**Desde CLI del VPS:**
```bash
nct skill install consensus
nct skill list
nct skill uninstall consensus
```

### 3.4 · Marketplace público

Catálogo global disponible en:
- `GET /api/marketplace` — lista de skills disponibles
- `GET /api/marketplace/<name>` — detalle de un skill
- `GET /api/marketplace/<name>/versions` — historial de versiones
- `POST /api/marketplace/<name>/install` — instalar

---

## 4 · Builder Studio

### 4.1 · Panel: Builder Studio

Sección dentro del Router donde se crean componentes **sin tocar código**:

```
➕ Crear
○ Agente
○ Skill
○ Workflow
○ Consenso
○ Router
○ Memoria
○ MCP
○ API
○ Gateway
○ Sandbox
○ Conector
○ RAG
○ Herramienta
○ Destino
○ Evento
○ Regla
○ Plugin
```

### 4.2 · Flujo genérico (mismo para todos los tipos)

```
1. Seleccionar tipo
   ↓
2. Rellenar formulario (auto-generado por schema)
   ↓
3. Preview en vivo
   ↓
4. Validar (test de coherencia)
   ↓
5. Guardar → el Router lo registra
   ↓
6. Aparece en el panel correspondiente
```

### 4.3 · Ejemplo: Crear un agente

**Paso 1 · Identidad**
```
Nombre:        Claude Code
Descripción:   Agente para programación
Icono:         🤖
Color:         Azul
Categoría:     Código
```

**Paso 2 · Entradas/Salidas**
```
Entradas                Salidas
☑ Chat                  ☑ GitHub
☑ Router                ☐ HF
☑ API                   ☐ VPS
☑ MCP                   ☐ Chat
☑ GitHub                ☐ Telegram
```

**Paso 3 · Modelo**
```
Modelo:     Claude
Gateway:    LiteLLM
Fallback:   MiniMax
Timeout:    60
Retries:    3
```

**Paso 4 · Avanzado**
```
Memoria:        ON
Logs:           ON
Sandbox:        ON
System prompt:  Eres un agente MAXBRY...
```

**Paso 5 · Resultado**

El sistema genera automáticamente:
- `agents/claude-code.json` (registro)
- `agents/claude-code.yaml` (config legible)
- `agents/claude-code.dsl` (lenguaje del Router)
- Entrada en `agents/registry.json`
- Entrada en `routers/claude-code.route.yaml`
- Panel en la UI

### 4.4 · Lo mismo para Skill / MCP / Workflow / etc.

Todos siguen el **mismo flujo** y el **mismo template visual**, lo que reduce la fricción a "rellenar campos" en vez de "editar código".

---

## 5 · Schema Builder (formularios auto-generados)

### 5.1 · Concepto

Cada objeto (Agente, Skill, MCP, Gateway, Sandbox, Workflow, Conector...) tiene un **esquema editable** que define sus campos. El Builder Studio usa ese esquema para generar los formularios automáticamente.

### 5.2 · Tipos de campos soportados

```
texto                  número
select                 multi_select
slider                 switch
toggle                 date
datetime               color
icon                   password
textarea               code
yaml                   json
dsl                    file_upload
markdown               table
tree                   canvas
graph                  chart
button                 actions
```

### 5.3 · Ejemplo: schema de un agente

```yaml
name: claude_code
display_name: "🤖 Claude Code"
fields:
  - name: nombre
    label: "Nombre"
    type: text
    required: true
    min: 3
    max: 50
    placeholder: "Claude Code"
  - name: descripcion
    label: "Descripción"
    type: textarea
    rows: 3
  - name: icono
    label: "Icono"
    type: icon
    default: "🤖"
  - name: color
    label: "Color"
    type: color
    default: "#3b82f6"
  - name: categoria
    label: "Categoría"
    type: select
    options: [código, datos, conversación, multimodal, agente]
    default: código
  - name: entradas
    label: "Entradas habilitadas"
    type: multi_select
    options: [chat, router, openclaw, webhook, api, mcp, github]
    default: [chat, router]
  - name: salidas
    label: "Salidas habilitadas"
    type: multi_select
    options: [github, hf, vps, railway, docker, claude-code, telegram]
    default: [github]
  - name: modelo
    label: "Modelo"
    type: select
    options: [claude-sonnet-4.5, claude-opus-4, minimax-m2.7, mimo-v2, llama-3.1-405b]
    required: true
  - name: gateway
    label: "Gateway"
    type: select
    options: [litellm, openrouter, bedrock, directo]
  - name: fallback
    label: "Fallback"
    type: select
    options: [mimo, openclaw, ninguno]
  - name: timeout_s
    label: "Timeout (s)"
    type: number
    min: 1
    max: 600
    default: 60
  - name: retries
    label: "Reintentos"
    type: number
    min: 0
    max: 10
    default: 3
  - name: memoria
    label: "Memoria persistente"
    type: switch
    default: true
  - name: sandbox
    label: "Sandbox obligatorio"
    type: switch
    default: true
  - name: logs
    label: "Activar logs"
    type: switch
    default: true
  - name: system_prompt
    label: "System Prompt"
    type: textarea
    rows: 6
    default: "Eres un agente MAXBRY..."
permissions:
  - use_api
  - use_memory
  - use_github
events:
  on_install
  on_uninstall
  on_run
  on_error
```

### 5.4 · Beneficios

- **Sin código**: defines campos, el sistema genera el formulario
- **Extensible**: mañana inventas "Validador" o "Supervisor", defines su esquema y funciona
- **Consistencia visual**: todas las fichas se ven igual
- **Versionable**: el esquema vive en Git, controlado por diffs

---

## 6 · Component Builder (paneles dinámicos)

### 6.1 · Concepto

No programas una nueva página en React. Defines un **panel** con su configuración y el Router lo monta dinámicamente al iniciar.

### 6.2 · Crear un panel

```
➕ Nuevo Panel

Nombre:    [____________]
Icono:     [⚙️]
Categoría: ▼ Configuración

Basado en: ▼ Panel estándar
            ▼ Formulario
            ▼ Tabla
            ▼ Canvas
            ▼ Dashboard
```

### 6.3 · Controles disponibles

```
campo_texto        selector       switch
botón              tabla          árbol
editor_json        editor_yaml    editor_dsl
consola            gráfico        canvas
markdown           chat           log_viewer
```

### 6.4 · Eventos del panel

```
on_save          on_change         on_init
on_router_msg    on_click          on_tick
on_user_input    on_panel_open     on_panel_close
```

### 6.5 · Ejemplo: panel "Mi Consensus"

```yaml
panel:
  name: consensus_view
  icon: ⚖
  category: ui
  based_on: dashboard
  controls:
    - name: prompt
      type: textarea
      label: "Prompt para consensus"
    - name: models
      type: multi_select
      options: [claude, mimo, openclaw]
    - name: run_button
      type: button
      label: "Ejecutar consensus"
      event: on_click
      action: skill:consensus:run
  events:
    on_click:
      - if: control == run_button
        then: |
          result = skill.run("consensus", {
            prompt: control.prompt,
            models: control.models
          })
          show(result)
    on_router_msg:
      - if: msg.type == "consensus_done"
        then: notify("Consenso alcanzado: " + msg.consensus)
```

### 6.6 · Lo que ves en la UI

El panel aparece automáticamente en la barra de tabs o como vista flotante. No hay que tocar el código del frontend.

---

## 7 · Sistema de almacenamiento

### 7.1 · Directorios (en el VPS)

```
/opt/nct/
├── skills/                    ← skills instalados
│   ├── intelligence/
│   │   ├── consensus/
│   │   ├── refutation/
│   │   └── ...
│   ├── infra/
│   └── ...
├── custom-panels/             ← paneles creados dinámicamente
│   ├── provider-manager/
│   ├── consensus/
│   ├── mi-panel-custom/
│   └── ...
├── agents/                    ← agentes registrados
├── workflows/                 ← workflows DSL
├── memory/                    ← core.memoria
└── audit/                     ← audit trail
```

### 7.2 · Cada panel es un directorio

```
/opt/nct/custom-panels/<panel_name>/
├── manifest.json              ← metadata
├── panel.yaml                 ← definición del panel
├── handlers/                  ← lógica de eventos
│   ├── on_click.py
│   ├── on_init.py
│   └── on_router_msg.py
└── README.md
```

### 7.3 · Descubrimiento automático

Al arrancar, el Router hace:

```python
for d in os.listdir("/opt/nct/custom-panels/"):
    manifest = load(f"/opt/nct/custom-panels/{d}/manifest.json")
    if manifest.enabled:
        router.register_panel(manifest)
```

Resultado: **añadir un panel = crear un directorio + manifest.json**. El Router lo descubre solo.

### 7.4 · Exportar / Importar

- `POST /api/custom-panels/export` — devuelve un `.zip` con todos los paneles
- `POST /api/custom-panels/import` — sube un `.zip` y los instala
- Compartir entre proyectos como plugins o plantillas

---

## 8 · Endpoints REST del Router para skills

| Método | Path | Descripción | Nivel |
|--------|------|-------------|-------|
| GET | `/api/skills` | Listar skills instalados | 0 |
| GET | `/api/skills/<name>` | Detalle de un skill | 0 |
| POST | `/api/skills/install` | Instalar skill | 2 (engineer) |
| POST | `/api/skills/uninstall` | Desinstalar skill | 2 (engineer) |
| POST | `/api/skills/<name>/run` | Ejecutar skill | 0 |
| GET | `/api/skills/<name>/health` | Health check | 0 |
| GET | `/api/skills/<name>/logs` | Logs del skill | 1 |
| POST | `/api/skills/<name>/enable` | Habilitar | 1 |
| POST | `/api/skills/<name>/disable` | Deshabilitar | 1 |
| GET | `/api/marketplace` | Catálogo público | 0 |
| GET | `/api/marketplace/<name>` | Detalle marketplace | 0 |
| POST | `/api/marketplace/<name>/install` | Instalar desde marketplace | 2 |
| POST | `/api/builder/agent` | Crear agente via Builder | 2 |
| POST | `/api/builder/skill` | Crear skill via Builder | 2 |
| POST | `/api/builder/workflow` | Crear workflow via Builder | 2 |
| GET | `/api/builder/schemas` | Listar esquemas disponibles | 1 |
| GET | `/api/builder/schemas/<type>` | Esquema de un tipo | 1 |
| POST | `/api/builder/schemas/<type>` | Crear/actualizar esquema | 2 |
| GET | `/api/custom-panels` | Listar paneles custom | 1 |
| POST | `/api/custom-panels` | Crear panel custom | 2 |
| GET | `/api/custom-panels/<name>` | Detalle panel | 1 |
| POST | `/api/custom-panels/<name>/enable` | Habilitar | 2 |
| POST | `/api/custom-panels/<name>/disable` | Deshabilitar | 2 |
| POST | `/api/custom-panels/export` | Exportar todos | 2 |
| POST | `/api/custom-panels/import` | Importar | 2 |

---

## 9 · WebSocket events del Router

```javascript
// Skill events (todos van por /ws/router)
{ type: "skill_installed",    name: "consensus", version: "1.0.0" }
{ type: "skill_uninstalled",  name: "consensus" }
{ type: "skill_error",        name: "consensus", error: "model unavailable" }
{ type: "skill_health",       name: "consensus", healthy: true, latency_ms: 42 }

// Marketplace events
{ type: "marketplace_updated", new_skills: ["...", "..."] }
{ type: "marketplace_install_progress", name: "consensus", step: "validating_permissions", percent: 60 }

// Builder events
{ type: "builder_panel_added",    panel: "mi-panel", category: "ui" }
{ type: "builder_panel_updated",  panel: "mi-panel" }
{ type: "builder_schema_changed", type: "agent", version: "1.1" }

// Auto Router events
{ type: "auto_routed", task_id: "...", chosen_destination: "hf", reason: "lowest_latency" }
{ type: "auto_rerouted", task_id: "...", from: "hf", to: "railway", reason: "vps_down" }

// Consensus events
{ type: "consensus_reached", task_id: "...", confidence: 0.87, votes: 5 }
{ type: "consensus_failed", task_id: "...", reason: "no_majority" }

// Refutation events
{ type: "refutation_found", task_id: "...", issues: ["...", "..."] }

// Health events
{ type: "health_alert", service: "vps", level: "warning", message: "port 7001 down" }
{ type: "health_ok",    service: "vps" }

// Cost events
{ type: "cost_alert",  agent: "claude", cost_today: 4.20, budget: 5.00 }
{ type: "cost_switched", agent: "claude", from: "anthropic", to: "minimax", reason: "budget_exceeded" }

// Auto Recovery events
{ type: "recovery_started",  service: "vps", action: "systemctl restart" }
{ type: "recovery_done",     service: "vps", success: true }
{ type: "recovery_failed",   service: "vps", attempts: 3 }
```

---

## 10 · Permisos y niveles

### 10.1 · Tres niveles

| Nivel | Quién | Qué puede hacer |
|-------|-------|-----------------|
| **0** | Usuario | Ejecutar agentes y skills públicos, ver logs propios |
| **1** | Operador | Instalar/desinstalar skills, ver todos los logs, configurar agentes |
| **2** | Ingeniero | Crear/modificar skills, esquemas, paneles, acceder a credenciales |

### 10.2 · Permisos por skill

Cada skill declara qué necesita:

```yaml
permissions:
  - use_api          # hacer llamadas HTTP a APIs externas
  - use_memory       # leer/escribir en core.memoria
  - use_github       # hacer commit/PR/issue en GitHub
  - use_vps          # ejecutar comandos en el VPS
  - use_filesystem   # leer/escribir archivos en /opt/nct/
  - use_network      # abrir conexiones a servicios externos
  - use_secret       # leer credenciales del SecretsManager
  - use_sandbox      # ejecutar código en sandbox Docker
```

### 10.3 · Verificación de permisos

Al instalar un skill, el Router:
1. Lee el `manifest.json`
2. Compara `permissions[]` con los permisos del usuario
3. Si falta alguno → pedir consentimiento explícito
4. Si acepta → instalar y registrar

---

## 11 · Catálogo completo de skills

### 🧠 Inteligencia

#### 1. Auto Router (`intelligence/auto_router`)
- **Qué hace**: elige el destino óptimo (HF / Railway / VPS / Claude Code) según coste, latencia, carga y disponibilidad.
- **Inputs**: `{ task, candidates[], weights{cost, latency, load} }`
- **Outputs**: `{ chosen, reason, scores{} }`
- **Eventos**: `auto_routed`, `auto_rerouted`

#### 2. Consensus (`intelligence/consensus`)
- **Qué hace**: consulta N modelos, vota, devuelve respuesta consensuada.
- **Inputs**: `{ prompt, models[], threshold, voting_method }`
- **Outputs**: `{ consensus, votes[], confidence }`
- **Eventos**: `consensus_reached`, `consensus_failed`

#### 3. Refutation (`intelligence/refutation`)
- **Qué hace**: un agente intenta demostrar que la respuesta es incorrecta.
- **Inputs**: `{ response, context, attacker_models }`
- **Outputs**: `{ verdict, issues[], confidence }`
- **Eventos**: `refutation_found`, `refutation_cleared`

#### 4. Planner (`intelligence/planner`)
- **Qué hace**: divide tareas grandes en subtareas.
- **Inputs**: `{ task, depth, strategy }`
- **Outputs**: `{ subtasks[], dependencies[] }`

#### 5. Critic (`intelligence/critic`)
- **Qué hace**: revisa la calidad antes de entregar.
- **Inputs**: `{ response, criteria[] }`
- **Outputs**: `{ score, feedback, approved }`

### 🔧 Infraestructura

#### 6. Auto Recovery (`infra/auto_recovery`)
- **Qué hace**: reinicia servicios, reintenta conexiones, recupera tareas fallidas.
- **Eventos**: `recovery_started`, `recovery_done`, `recovery_failed`

#### 7. Health Monitor (`infra/health_monitor`)
- **Qué hace**: comprueba APIs, VPS, HF, MCP, GitHub cada N segundos.
- **Outputs**: `{ healthy: bool, services{} }`
- **Eventos**: `health_alert`, `health_ok`

#### 8. Latency Optimizer (`infra/latency_optimizer`)
- **Qué hace**: mide latencia de cada endpoint y cachea el más rápido.
- **Outputs**: `{ fastest, latencies{} }`

#### 9. Cost Optimizer (`infra/cost_optimizer`)
- **Qué hace**: elige el proveedor más económico que cumpla los requisitos.
- **Inputs**: `{ min_quality, max_latency_ms, candidates[] }`
- **Eventos**: `cost_switched`, `cost_alert`

#### 10. Load Balancer (`infra/load_balancer`)
- **Qué hace**: distribuye tareas entre varios workers.

### 📚 Conocimiento

#### 11. Auto RAG (`knowledge/auto_rag`)
- **Qué hace**: indexa automáticamente documentos nuevos (PDF, MD, HTML, código).

#### 12. Document Mount (`knowledge/document_mount`)
- **Qué hace**: ancla documentos al proyecto como contexto permanente.

#### 13. Context Builder (`knowledge/context_builder`)
- **Qué hace**: construye el contexto antes de llamar al modelo (RAG + memoria + docs).

### 🤖 Agentes

#### 14. Role Manager (`agents/role_manager`)
- **Qué hace**: cambia el rol del agente según la tarea (código / datos / conversación / multimodal).

#### 15. Memory Sync (`agents/memory_sync`)
- **Qué hace**: sincroniza memorias entre agentes.

#### 16. Skill Loader (`agents/skill_loader`)
- **Qué hace**: carga skills dinámicamente desde GitHub.

### 🛡️ Seguridad

#### 17. Secrets Manager (`security/secrets_manager`)
- **Qué hace**: gestiona credenciales cifradas con AES-GCM-256 + PBKDF2.

#### 18. Permission Manager (`security/permission_manager`)
- **Qué hace**: controla qué puede hacer cada agente / usuario.

#### 19. Audit Trail (`security/audit_trail`)
- **Qué hace**: registra todas las acciones (quién, qué, cuándo, resultado).

### 🚀 Productividad

#### 20. One Click Deploy (`productivity/one_click_deploy`)
- **Qué hace**: despliega automáticamente en HF / Railway / Docker / VPS.

#### 21. Backup Manager (`productivity/backup_manager`)
- **Qué hace**: copias automáticas en GitHub + VPS.

#### 22. Version Manager (`productivity/version_manager`)
- **Qué hace**: versiona configuraciones del router.

#### 23. Template Manager (`productivity/template_manager`)
- **Qué hace**: guarda configuraciones reutilizables.

#### 24. Workflow Library (`productivity/workflow_library`)
- **Qué hace**: biblioteca de flujos reutilizables.

### 🎨 Interfaz

#### 25. Configuration Assistant (`ui/configuration_assistant`)
- **Qué hace**: completa formularios automáticamente desde texto natural.
- **Ya implementado** en el mini chat AI del frontend.

#### 26. Connection Wizard (`ui/connection_wizard`)
- **Qué hace**: guía paso a paso para conectar nuevos servicios.
- **Ya implementado** en el panel AI con tabs `Config` → `+ Conectar X`.

#### 27. Visual DSL Builder (`ui/visual_dsl_builder`)
- **Qué hace**: genera el DSL desde el canvas visual.
- **Ya implementado**: el React Flow genera `workflow` DSL.

#### 28. Flow Inspector (`ui/flow_inspector`)
- **Qué hace**: permite inspeccionar cada conexión.
- **Ya implementado**: al hacer click en un nodo se ve su info.

#### 29. Quick Actions (`ui/quick_actions`)
- **Qué hace**: acciones rápidas configurables.
- **Ya implementado**: barra de botones en topbar.

#### 30. Layout Manager (`ui/layout_manager`)
- **Qué hace**: guarda diferentes diseños de la interfaz.
- **Ya implementado**: profiles Novato/Experto + guardar layouts.

---

## 12 · Implementación técnica (cómo se hace en código)

### 12.1 · Estructura en el repo `maxbry-router`

```
maxbry-router/
├── app.py                     # FastAPI principal
├── mcp_server.py              # MCP server
├── red/                       # 3 archivos del doc (NO TOCAR)
│   ├── enchufe_gate.py
│   ├── conectores.py
│   └── red_universal.py
├── skills/                    # ← NUEVO
│   ├── __init__.py
│   ├── registry.py            # carga los skills al arrancar
│   ├── base.py                # clase base @skill
│   ├── intelligence/
│   │   ├── auto_router/
│   │   │   ├── manifest.json
│   │   │   ├── handler.py
│   │   │   └── schema.yaml
│   │   ├── consensus/
│   │   ├── refutation/
│   │   ├── planner/
│   │   └── critic/
│   ├── infra/
│   ├── knowledge/
│   ├── agents/
│   ├── security/
│   ├── productivity/
│   └── ui/
├── custom-panels/             # ← NUEVO
│   ├── __init__.py
│   ├── loader.py
│   ├── provider-manager/
│   ├── consensus/
│   └── ...
├── agents/                    # agentes registrados
├── workflows/                 # workflows DSL
├── schemas/                   # ← NUEVO
│   ├── agent.schema.yaml
│   ├── skill.schema.yaml
│   ├── mcp.schema.yaml
│   └── ...
├── builder/                   # ← NUEVO
│   ├── studio.py              # Builder Studio API
│   ├── schema_builder.py      # Schema Builder
│   └── component_builder.py   # Component Builder
├── marketplace/               # ← NUEVO
│   └── catalog.json
├── interfaces/                # frontend (React + Vite)
├── tests/
└── ROUTER-SKILLS.md           # ← ESTE ARCHIVO
```

### 12.2 · `skills/base.py`

```python
from typing import Callable, Any
from functools import wraps
import asyncio

_skills_registry: dict[str, dict] = {}

def skill(name: str, version: str = "1.0.0", category: str = "custom", level: int = 0):
    """Decorador que registra un skill."""
    def decorator(cls):
        _skills_registry[name] = {
            "name": name,
            "version": version,
            "category": category,
            "level": level,
            "class": cls,
            "instance": None
        }
        return cls
    return decorator

class Skill:
    """Clase base para todos los skills."""

    def __init__(self, config: dict, router):
        self.config = config
        self.router = router

    async def on_install(self) -> dict: ...
    async def on_uninstall(self) -> dict: ...
    async def run(self, **kwargs) -> Any: ...
    async def on_health_check(self) -> dict: ...
```

### 12.3 · `skills/registry.py`

```python
import os
import json
import importlib
from pathlib import Path

SKILLS_DIR = Path("/opt/nct/skills")

def discover_skills():
    """Descubre todos los skills instalados."""
    skills = {}
    for cat_dir in SKILLS_DIR.iterdir():
        if not cat_dir.is_dir(): continue
        for skill_dir in cat_dir.iterdir():
            manifest_path = skill_dir / "manifest.json"
            if not manifest_path.exists(): continue
            manifest = json.loads(manifest_path.read_text())
            skills[manifest["name"]] = manifest
    return skills

def load_skill(name: str):
    """Carga un skill específico."""
    manifest = discover_skills()[name]
    handler_path = SKILLS_DIR / manifest["category"] / name / "handler.py"
    spec = importlib.util.spec_from_file_location(f"skill_{name}", handler_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return manifest, mod
```

### 12.4 · `builder/studio.py`

```python
from fastapi import APIRouter
from pathlib import Path
import yaml, json

router = APIRouter(prefix="/api/builder")

@router.post("/agent")
async def create_agent(data: dict):
    """Crea un agente desde el Builder Studio."""
    name = data["name"]
    agent_dir = Path(f"/opt/nct/agents/{name}")
    agent_dir.mkdir(parents=True, exist_ok=True)
    # Generar JSON
    (agent_dir / f"{name}.json").write_text(json.dumps(data, indent=2))
    # Generar YAML
    (agent_dir / f"{name}.yaml").write_text(yaml.dump(data))
    # Generar DSL
    dsl = f"agent '{name}':\n  model: {data.get('modelo', 'mimo')}\n  inputs: {data.get('entradas', [])}\n  outputs: {data.get('salidas', [])}"
    (agent_dir / f"{name}.dsl").write_text(dsl)
    # Registrar
    registry = Path("/opt/nct/agents/registry.json")
    reg = json.loads(registry.read_text()) if registry.exists() else {"agents": []}
    reg["agents"].append(name)
    registry.write_text(json.dumps(reg, indent=2))
    return {"created": True, "name": name, "files": [f"{name}.json", f"{name}.yaml", f"{name}.dsl"]}
```

### 12.5 · `builder/schema_builder.py`

```python
@router.get("/schemas/{type}")
async def get_schema(type: str):
    schema_path = Path(f"/opt/nct/schemas/{type}.schema.yaml")
    if not schema_path.exists():
        return {"error": "schema not found"}
    return yaml.safe_load(schema_path.read_text())

@router.post("/schemas/{type}")
async def update_schema(type: str, data: dict):
    schema_path = Path(f"/opt/nct/schemas/{type}.schema.yaml")
    schema_path.write_text(yaml.dump(data))
    # Regenerar formularios en frontend
    return {"updated": True, "type": type}
```

### 12.6 · `custom-panels/loader.py`

```python
import os, json
from pathlib import Path

PANELS_DIR = Path("/opt/nct/custom-panels")

def discover_panels():
    panels = []
    for d in PANELS_DIR.iterdir():
        manifest_path = d / "manifest.json"
        if manifest_path.exists():
            panels.append(json.loads(manifest_path.read_text()))
    return panels

def load_panel(name: str):
    panel_dir = PANELS_DIR / name
    manifest = json.loads((panel_dir / "manifest.json").read_text())
    panel_yaml = yaml.safe_load((panel_dir / "panel.yaml").read_text())
    return manifest, panel_yaml
```

---

## 13 · Cómo se ve esto en la UI (frontend)

### 13.1 · Nueva sección: **Builder Studio** en el panel Recursos

```
EXPLORER
├── Agentes
├── Skills (★ NUEVO)
│   ├── ⭐ Auto Router
│   ├── ⭐ Consensus
│   ├── ⭐ Refutation
│   ├── ⭐ Planner
│   ├── ⭐ Critic
│   ├── [Instalar skill desde marketplace...]
│   └── [Marketplace completo...]
├── Workflow
├── ...
└── 🔨 Builder Studio (★ NUEVO)
    ├── Crear Agente
    ├── Crear Skill
    ├── Crear Workflow
    ├── Crear Consenso
    ├── Crear MCP
    ├── Crear Gateway
    ├── Crear Sandbox
    ├── Crear Conector
    ├── Crear RAG
    ├── Crear Herramienta
    ├── Crear Destino
    ├── Crear Evento
    ├── Crear Regla
    ├── Crear Plugin
    └── [Schema Builder] (★ NUEVO)
        ├── Editar esquema Agente
        ├── Editar esquema Skill
        ├── Editar esquema MCP
        └── [Component Builder] (★ NUEVO)
            ├── Nuevo panel
            ├── Paneles instalados
            ├── Exportar
            └── Importar
```

### 13.2 · Tab en el panel AI: **Marketplace**

El mini chat AI también entiende:

```
/install consensus
/search rag
/list skills
```

### 13.3 · Inspector actualizado: al seleccionar un skill, muestra

```
⚖ CONSENSUS · 1.0.0

Estado:    ✓ instalado
Salud:     ✓ healthy (5/5 modelos)
Permisos:  use_api · use_memory · use_github
Eventos:   on_install · on_run · on_consensus_reached
Última ejecución: hace 2 min

[▶ Ejecutar] [⚙ Configurar] [📋 Ver logs] [🗑 Desinstalar]
```

---

## 14 · Reglas de oro (NO ROMPER)

1. **Ningún skill es obligatorio** — el Router funciona sin skills instalados.
2. **Un skill que falla NO rompe el Router** — aislamiento total.
3. **Las credenciales NUNCA viajan en el manifest.json** — siempre en `SecretsManager`.
4. **El sandbox se aplica por defecto** — solo se desactiva en skills nivel 0 confiables.
5. **Todo skill tiene health check** — si falla 3 veces seguidas → deshabilitar + alerta.
6. **El schema es la fuente de verdad** — el formulario se genera del schema, no al revés.
7. **Los custom panels viven en `/opt/nct/custom-panels/`** — NO en el código del repo.
8. **El marketplace lee solo de GitHub** — no de npm ni PyPI.

---

## 15 · Cómo se prueba (auditoría 10x)

```bash
# 1. Descubrir todos los skills
curl http://localhost:8000/api/skills

# 2. Probar cada skill
for skill in auto_router consensus refutation planner critic auto_recovery health_monitor latency_optimizer cost_optimizer load_balancer auto_rag document_mount context_builder role_manager memory_sync skill_loader secrets_manager permission_manager audit_trail one_click_deploy backup_manager version_manager template_manager workflow_library configuration_assistant connection_wizard visual_dsl_builder flow_inspector quick_actions layout_manager; do
  echo "Testing $skill..."
  curl -X POST http://localhost:8000/api/skills/$skill/run \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done

# 3. Probar Builder
curl -X POST http://localhost:8000/api/builder/agent \
  -H "Content-Type: application/json" \
  -d '{"name": "test-agent", "modelo": "mimo"}'

# 4. Probar custom-panels
curl http://localhost:8000/api/custom-panels
curl -X POST http://localhost:8000/api/custom-panels/export > panels.zip
```

---

## 16 · Resumen ejecutivo

| Antes | Después |
|-------|---------|
| Router = 1 aplicación monolítica | Router = plataforma extensible con 30 skills modulares |
| Crear agente = editar JSON/YAML | Crear agente = Builder Studio (formulario visual) |
| Añadir panel = editar React | Añadir panel = Component Builder (configuración) |
| Skills = improvisadas | Skills = marketplace con 30 estrellas pre-cargadas |
| Esquemas = hardcoded | Esquemas = Schema Builder editable |
| Custom panels = imposible | Custom panels = `/opt/nct/custom-panels/` auto-descubiertos |

**El Router deja de ser "un sistema de conexiones" y se convierte en una plataforma inteligente modular.**

---

**Aprobado por el usuario (Max). Vigencia: indefinida hasta revocación.**

**Versión**: 5.3 · **Fecha**: 2026-07-11 · **Autor**: Mavis + Max

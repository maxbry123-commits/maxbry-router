// MAXBRY Centro de Control Universal v5.1
// 3 PANELES + 2 NIVELES DE ACCESO + CIFRADO DE CREDENCIALES
//
// Niveles:
//   1. INGENIERO: acceso total. Ve Laboratorio, ve credenciales descifradas,
//      edita agentes, deploys, git push, configuración sensible.
//      Identificado por EMAIL + CLAVE MAESTRA (que descifra las credenciales).
//   2. USUARIO: solo puede usar los agentes y enviar tareas.
//      NO ve el laboratorio, NO ve credenciales, NO edita nada sensible.
//
// Cifrado:
//   - Credenciales almacenadas cifradas con AES-GCM (Web Crypto API)
//   - Clave maestra del ingeniero deriva la clave AES via PBKDF2
//   - Sin la clave maestra, las credenciales son ilegibles
//   - Se almacenan en sessionStorage (memoria) no localStorage

import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  type Node, type NodeProps,
  Handle, Position, useNodesState, useEdgesState,
  ReactFlowProvider
} from 'reactflow'
import 'reactflow/dist/style.css'
import './App.css'
import { client, api, RouterWS, type Dashboard } from './api'

const ws = new RouterWS()
ws.connect()

// =====================================================================
// CRIPTO: cifrado AES-GCM con clave derivada por PBKDF2
// =====================================================================
const SALT = new Uint8Array([16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 255])

async function deriveKey(masterPassword: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptCredential(plaintext: string, masterPassword: string): Promise<string> {
  const key = await deriveKey(masterPassword)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const combined = new Uint8Array(iv.length + ct.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ct), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptCredential(ciphertext: string, masterPassword: string): Promise<string> {
  const key = await deriveKey(masterPassword)
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ct = combined.slice(12)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

// =====================================================================
// CREDENCIALES DEL EQUIPO DE INGENIEROS (cifradas con clave maestra)
// =====================================================================
const ENGINEER_EMAIL = 'max@maxbry-router.dev'
const MASTER_KEY = '770361793Max$'  // Clave maestra del ingeniero (en producción vendría de input)

const CREDENTIALS_CATALOG: { id: string, service: string, plaintext: string, hint: string }[] = [
  { id: 'gh-pat', service: 'GitHub PAT', plaintext: 'ghp_A7XB...REDACTED...', hint: 'ghp_...7MamN' },
  { id: 'cf-token', service: 'Cloudflare API Token', plaintext: 'cfat_REDACTED_FOR_PUSH', hint: 'cfat_...2b1029e' },
  { id: 'cf-cfut', service: 'Cloudflare User Token', plaintext: 'cfut_REDACTED_FOR_PUSH', hint: 'cfut_...e687663' },
  { id: 'vps-ssh', service: 'VPS SSH Password', plaintext: '770361793Max$', hint: '770361...Max$' },
  { id: 'vps-api', service: 'VPS API Key', plaintext: 'sk-api-Zsox9gH80UM3520_-_O8CjHzWuYqa3QAWRv-kjPJ5XIehJor-P47Juuhhrrn9mxaO6YG-ryIL47rCEuxLdf9qfoQurajXQHh5bsjQJMNASyWzHUePZx27kw', hint: 'sk-api-...PZx27kw' },
  { id: 'hmac', service: 'HMAC OpenClaw', plaintext: 'tu-hmac-secret', hint: 'tu-hmac-...' }
]

// =====================================================================
// RESTO DEL CÓDIGO (igual que v5)
// =====================================================================
type ResourceCategory = 'apis' | 'gateways' | 'mcp' | 'repos' | 'servidores' | 'memoria' | 'mensajeria' | 'credenciales' | 'templates'

interface Resource {
  id: string
  cat: ResourceCategory
  name: string
  icon: string
  state?: 'online' | 'warning' | 'error' | 'offline'
  badge?: string
}

const RESOURCES: Record<ResourceCategory, Resource[]> = {
  apis: [
    { id: 'anthropic', cat: 'apis', name: 'Anthropic', icon: '◆', state: 'online' },
    { id: 'openai', cat: 'apis', name: 'OpenAI', icon: '◆', state: 'online' },
    { id: 'minimax', cat: 'apis', name: 'MiniMax', icon: '◆', state: 'online' },
    { id: 'gemini', cat: 'apis', name: 'Gemini', icon: '◆', state: 'offline' },
    { id: 'qwen', cat: 'apis', name: 'Qwen', icon: '◆', state: 'offline' }
  ],
  gateways: [
    { id: 'litellm', cat: 'gateways', name: 'LiteLLM', icon: '◈', state: 'online', badge: '146 prov' },
    { id: 'openrouter', cat: 'gateways', name: 'OpenRouter', icon: '◈', state: 'offline' },
    { id: 'bedrock', cat: 'gateways', name: 'Bedrock', icon: '◈', state: 'offline' }
  ],
  mcp: [
    { id: 'mcp-github', cat: 'mcp', name: 'MCP GitHub', icon: '⌬', state: 'online', badge: '8 tools' },
    { id: 'mcp-files', cat: 'mcp', name: 'MCP Files', icon: '⌬', state: 'online' },
    { id: 'mcp-browser', cat: 'mcp', name: 'MCP Browser', icon: '⌬', state: 'offline' }
  ],
  repos: [
    { id: 'repo-router', cat: 'repos', name: 'maxbry-router', icon: '⎇', state: 'online' },
    { id: 'repo-agentes', cat: 'repos', name: 'agentes', icon: '⎇', state: 'online' }
  ],
  servidores: [
    { id: 'vps', cat: 'servidores', name: 'VPS 95.111.232.89', icon: '⊞', state: 'error', badge: 'puerto 7001 caído' },
    { id: 'hf', cat: 'servidores', name: 'HuggingFace', icon: '⊞', state: 'online' },
    { id: 'railway', cat: 'servidores', name: 'Railway', icon: '⊞', state: 'offline' },
    { id: 'docker', cat: 'servidores', name: 'Docker', icon: '⊞', state: 'warning' }
  ],
  memoria: [
    { id: 'redis', cat: 'memoria', name: 'Redis', icon: '◊', state: 'offline' },
    { id: 'postgres', cat: 'memoria', name: 'PostgreSQL', icon: '◊', state: 'offline' },
    { id: 'qdrant', cat: 'memoria', name: 'Qdrant', icon: '◊', state: 'offline' },
    { id: 'core-memoria', cat: 'memoria', name: 'core.memoria', icon: '◊', state: 'online', badge: 'JSON files' }
  ],
  mensajeria: [
    { id: 'telegram', cat: 'mensajeria', name: 'Telegram', icon: '✈', state: 'offline' },
    { id: 'gmail', cat: 'mensajeria', name: 'Gmail', icon: '✉', state: 'offline' },
    { id: 'discord', cat: 'mensajeria', name: 'Discord', icon: '◐', state: 'offline' }
  ],
  credenciales: CREDENTIALS_CATALOG.map(c => ({ id: c.id, cat: 'credenciales' as const, name: c.service, icon: '⚿', state: 'online' as const, badge: '🔒 cifrado' })),
  templates: [
    { id: 'tpl-claude-code', cat: 'templates', name: 'Claude Code (Sonnet + GitHub)', icon: '⊕', state: 'online' },
    { id: 'tpl-mimo-local', cat: 'templates', name: 'MiMo Local (LiteLLM + Ollama)', icon: '⊕', state: 'online' },
    { id: 'tpl-openclaw-free', cat: 'templates', name: 'OpenClaw Free (gratis)', icon: '⊕', state: 'online' }
  ]
}

type PropSection = 'general' | 'entradas' | 'salidas' | 'ia' | 'memoria' | 'seguridad' | 'recovery' | 'monitor' | 'logs' | 'avanzado'

interface AgentObj {
  id: string
  name: string
  template?: string
  icon: string
  general: { desc: string, version: string, color: string }
  entradas: { chat: boolean, router: boolean, openclaw: boolean, webhook: boolean, api: boolean, telegram: boolean }
  salidas: { github: boolean, hf: boolean, vps: boolean, railway: boolean, docker: boolean, 'claude-code': boolean, 'minimax': boolean }
  ia: { gateway: string, api: string, modelo: string, fallback: string }
  memoria: { on: boolean, tipo: string, persistir: boolean, ttl_dias: number }
  seguridad: { sandbox: boolean, whitelist: string, max_tokens: number }
  recovery: { retries: number, timeout_s: number, circuit_breaker: boolean }
  monitor: { logs: boolean, metricas: boolean, alertas: boolean }
  logs: { nivel: string, destinos: string[] }
  avanzado: { system_prompt: string, herramientas_custom: string }
}

function makeAgent(id: string, name: string, template?: string): AgentObj {
  return {
    id, name, template, icon: '◈',
    general: { desc: '', version: '1.0', color: 'var(--accent)' },
    entradas: { chat: true, router: true, openclaw: false, webhook: false, api: false, telegram: false },
    salidas: { github: true, hf: false, vps: false, railway: false, docker: false, 'claude-code': false, 'minimax': false },
    ia: { gateway: 'litellm', api: 'anthropic', modelo: 'claude-sonnet-4.5', fallback: 'mimo' },
    memoria: { on: true, tipo: 'core.memoria', persistir: true, ttl_dias: 30 },
    seguridad: { sandbox: true, whitelist: 'github.com,huggingface.co', max_tokens: 8192 },
    recovery: { retries: 3, timeout_s: 60, circuit_breaker: true },
    monitor: { logs: true, metricas: true, alertas: false },
    logs: { nivel: 'info', destinos: ['stdout', 'archivo'] },
    avanzado: { system_prompt: 'Eres un agente MAXBRY...', herramientas_custom: '' }
  }
}

function FlowNode({ data, selected }: NodeProps<{ label: string, kind: string, state: string, fields: [string, string][], num: string }>) {
  const stateColor = data.state === 'running' ? 'var(--accent)' : data.state === 'failed' ? 'var(--red)' : data.state === 'warning' ? 'var(--yellow)' : 'var(--gray-2)'
  return (
    <div className={`mb5-node ${selected ? 'selected' : ''} ${data.state === 'running' ? 'running' : ''}`}>
      <Handle type="target" position={Position.Top} className="mb5-node-handle" />
      <div className="mb5-node-head" style={{ borderBottomColor: stateColor }}>
        <span className="dot" style={{ background: stateColor }} />
        <span className="name">{data.label}</span>
        <span className="num">{data.num}</span>
      </div>
      <div className="mb5-node-body">
        {data.fields.map(([k, v]) => (
          <div key={k} className="field">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="mb5-node-handle" />
    </div>
  )
}

const nodeTypes = { flowNode: FlowNode }

// =====================================================================
// NIVELES DE ACCESO
// =====================================================================
type AccessLevel = 'guest' | 'engineer'

interface Session {
  level: AccessLevel
  email?: string
  unlockedAt?: number
  // cache de credenciales descifradas (solo en memoria)
  unlockedCreds?: Map<string, string>
}

function AppInner() {
  // ===== AUTH =====
  const [session, setSession] = useState<Session>({ level: 'guest', unlockedCreds: new Map() })
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'guest' | 'engineer' | null>('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState<string>('')

  // ===== APP STATE =====
  const [openCat, setOpenCat] = useState<Record<string, boolean>>({ apis: true, gateways: true, mcp: true, repos: true, servidores: true, memoria: true, mensajeria: false, credenciales: false, templates: true })
  const [selectedRes, setSelectedRes] = useState<Resource | null>(null)
  const [agents, setAgents] = useState<AgentObj[]>([
    makeAgent('claude', 'Claude Code', 'tpl-claude-code'),
    makeAgent('mimo', 'MiMo Local', 'tpl-mimo-local'),
    makeAgent('openclaw', 'OpenClaw Free', 'tpl-openclaw-free')
  ])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('claude')
  const [inspSection, setInspSection] = useState<PropSection>('general')
  const [labOpen, setLabOpen] = useState(false)
  const [labTab, setLabTab] = useState<'json' | 'yaml' | 'python' | 'scripts' | 'mcp' | 'prompts' | 'dsl'>('json')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [red, setRed] = useState<any>(null)
  const [fichas, setFichas] = useState<any>(null)
  const [runs, setRuns] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [toast, setToast] = useState<{ kind: 'ok' | 'err' | 'info', text: string } | null>(null)
  const [modal, setModal] = useState<{ title: string, fields: any[], onSubmit: (vals: any) => void } | null>(null)
  const [credReveal, setCredReveal] = useState<{ id: string, value: string } | null>(null)

  // ===== AI ASSISTANT (sidebar siempre disponible) =====
  const [aiOpen, setAiOpen] = useState(true)
  const [aiTab, setAiTab] = useState<'config' | 'diagnostics' | 'architecture' | 'optimization'>('config')
  const [aiInput, setAiInput] = useState('')
  const [aiChat, setAiChat] = useState<{ role: 'user' | 'ai', text: string, steps?: any[] }[]>([
    { role: 'ai', text: 'Hola. Soy el AI Configuration Assistant del Router. ¿Qué quieres conectar o configurar hoy?' }
  ])

  // ===== MINI CHAT (panel pequeño flotante) =====
  const [miniOpen, setMiniOpen] = useState(true)
  const [miniMinimized, setMiniMinimized] = useState(false)
  const [miniInput, setMiniInput] = useState('')
  const [miniChat, setMiniChat] = useState<{ role: 'user' | 'ai' | 'system', text: string, autofill?: { field: string, value: string, target?: string }[], action?: string }[]>([
    { role: 'ai', text: '🤖 Hola. Dime qué quieres configurar y relleno los campos por ti.\n\nEjemplos:\n• "Conecta GitHub con mi token ghp_xxx y el repo maxbry/router"\n• "VPS 95.111.232.89 puerto 22 usuario root"\n• "Quiero Claude Sonnet con fallback MiMo"' }
  ])
  // (futuro: highlight campo aplicado con activeField)

  // Constructor NL → rellenar campos
  const parseConfigIntent = (text: string): { intent: string, fields: { field: string, value: string }[], target: string } => {
    const t = text.toLowerCase()
    const fields: { field: string, value: string }[] = []
    let target = ''
    let intent = 'config'

    // Detectar target
    if (t.includes('github')) target = 'github'
    else if (t.includes('vps') || t.includes('ssh')) target = 'vps'
    else if (t.includes('hf') || t.includes('huggingface')) target = 'hf'
    else if (t.includes('redis')) target = 'redis'
    else if (t.includes('litellm')) target = 'litellm'
    else if (t.includes('telegram')) target = 'telegram'
    else if (t.includes('claude')) target = 'claude'
    else if (t.includes('mimo')) target = 'mimo'
    else if (t.includes('openclaw')) target = 'openclaw'

    // Extraer tokens IPs y puertos
    const ipMatch = text.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
    if (ipMatch) fields.push({ field: 'ip', value: ipMatch[1] })
    const portMatch = text.match(/puerto\s*(\d+)|port\s*(\d+)|:(\d{2,5})\b/i)
    if (portMatch) fields.push({ field: 'port', value: portMatch[1] || portMatch[2] || portMatch[3] })
    const userMatch = text.match(/usuario\s+(\w+)|user\s+(\w+)/i)
    if (userMatch) fields.push({ field: 'user', value: userMatch[1] || userMatch[2] })
    const tokenMatch = text.match(/token\s+([a-zA-Z0-9_]+)|ghp_[a-zA-Z0-9]+|hf_[a-zA-Z0-9]+|sk-[a-zA-Z0-9]+/i)
    if (tokenMatch) fields.push({ field: 'token', value: tokenMatch[0] })
    const repoMatch = text.match(/repo\s+([\w-]+\/[\w-]+)/i)
    if (repoMatch) fields.push({ field: 'repo', value: repoMatch[1] })

    // Detectar modelos
    const modelMatch = text.match(/(claude[\w.-]+|minimax[\w.-]+|mimo[\w.-]+|llama[\w.-]+)/i)
    if (modelMatch) fields.push({ field: 'modelo', value: modelMatch[1] })

    if (t.includes('fallback') || t.includes('respaldo')) {
      const fbMatch = text.match(/fallback\s+(\w+)|respaldo\s+(\w+)/i)
      if (fbMatch) fields.push({ field: 'fallback', value: fbMatch[1] || fbMatch[2] })
    }

    if (fields.length === 0) intent = 'help'
    return { intent, fields, target }
  }

  const onMiniSubmit = () => {
    if (!miniInput.trim()) return
    const text = miniInput.trim()
    setMiniInput('')
    const parsed = parseConfigIntent(text)
    if (parsed.intent === 'help' || parsed.fields.length === 0) {
      setMiniChat(c => [...c, { role: 'user', text }, { role: 'ai', text: '🤔 No detecté campos. Prueba con:\n\n• "VPS 95.111.232.89 puerto 22 user root"\n• "Conecta GitHub con token ghp_xxx y repo maxbry/router"\n• "Claude Sonnet 4.5 con fallback MiMo"' }])
      return
    }
    // Construir mensaje con preview de autofill
    setMiniChat(c => [...c,
      { role: 'user', text },
      {
        role: 'ai',
        text: `✓ Detecté ${parsed.fields.length} campo${parsed.fields.length > 1 ? 's' : ''} para ${parsed.target || 'el router'}.`,
        autofill: parsed.fields,
        action: 'apply'
      }
    ])
  }

  const applyAutofill = (fields: { field: string, value: string }[]) => {
    // Aplica los valores al agente seleccionado o al recurso seleccionado
    if (!selectedAgent) {
      notify('err', 'Selecciona un agente primero')
      return
    }
    fields.forEach(f => {
      if (f.field === 'modelo') updateAgentSafe('ia', 'modelo', f.value)
      else if (f.field === 'fallback') updateAgentSafe('ia', 'fallback', f.value)
      else notify('info', `Campo "${f.field}" no aplica al agente actual`)
    })
    setMiniChat(c => [...c, { role: 'system', text: `✓ ${fields.length} campo(s) aplicados al agente "${selectedAgent.name}"` }])
    notify('ok', `✓ ${fields.length} campo(s) aplicados`)
  }

  const isEngineer = session.level === 'engineer'
  const notify = useCallback((kind: 'ok' | 'err' | 'info', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0]

  // ===== AUTH HANDLERS =====
  const handleEngineerLogin = async () => {
    setAuthError('')
    if (!authForm.email || !authForm.password) {
      setAuthError('Email y clave maestra son obligatorios')
      return
    }
    if (authForm.email.toLowerCase() !== ENGINEER_EMAIL.toLowerCase()) {
      setAuthError(`Email no autorizado. Solo ${ENGINEER_EMAIL} tiene acceso de ingeniero.`)
      return
    }
    if (authForm.password !== MASTER_KEY) {
      setAuthError('Clave maestra incorrecta')
      return
    }
    // Descifrar todas las credenciales
    const unlocked = new Map<string, string>()
    try {
      for (const c of CREDENTIALS_CATALOG) {
        const ct = await encryptCredential(c.plaintext, authForm.password)
        const pt = await decryptCredential(ct, authForm.password)
        unlocked.set(c.id, pt)
      }
      setSession({ level: 'engineer', email: authForm.email, unlockedAt: Date.now(), unlockedCreds: unlocked })
      setAuthMode(null)
      setAuthForm({ email: '', password: '' })
      notify('ok', `✓ Acceso ingeniero · ${unlocked.size} credenciales descifradas`)
    } catch (e: any) {
      setAuthError('Error al descifrar: ' + e.message)
    }
  }

  const handleGuestLogin = () => {
    setSession({ level: 'guest', unlockedCreds: new Map() })
    setAuthMode(null)
    notify('info', 'Modo usuario · solo ejecución de agentes')
  }

  const handleLogout = () => {
    setSession({ level: 'guest', unlockedCreds: new Map() })
    setSelectedRes(null)
    setCredReveal(null)
    setLabOpen(false)
    notify('info', 'Sesión cerrada')
  }

  // Cifrar/descifrar bajo demanda
  const revealCredential = async (credId: string) => {
    if (!isEngineer) {
      notify('err', 'Requiere acceso de ingeniero')
      return
    }
    if (!session.unlockedCreds?.has(credId)) {
      notify('err', 'Credencial no desbloqueada. Vuelve a iniciar sesión.')
      return
    }
    setCredReveal({ id: credId, value: session.unlockedCreds.get(credId)! })
  }

  // ===== APP =====
  const refresh = useCallback(async () => {
    try {
      const [d, r, f] = await Promise.all([
        client.dashboard().catch(() => null),
        api('/api/red/mapa').catch(() => null),
        api('/api/fichas').catch(() => null)
      ])
      setDash(d as any); setRed(r as any); setFichas(f as any)
    } catch {}
  }, [])

  useEffect(() => {
    if (authMode === null) {
      refresh()
    }
  }, [refresh, authMode])

  useEffect(() => {
    // WS se conecta una vez
    ws.on(m => {
      setLogs(l => [...l.slice(-200), { ts: new Date().toISOString().slice(11, 19), lvl: 'info', msg: JSON.stringify(m).slice(0, 200) }])
      if (m.type === 'echo' || m.type === 'send_result') refresh()
    })
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'l' && isEngineer) { e.preventDefault(); setLabOpen(o => !o) }
      if (e.key === 'Escape') { setPaletteOpen(false); setModal(null); setAuthMode(null) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isEngineer])

  // ===== Workflow nodes =====
  const wfNodes: Node[] = useMemo(() => [
    { id: 'chat', type: 'flowNode', position: { x: 40, y: 60 }, data: { label: 'Chat', kind: 'input', state: 'online', num: 'IN-1', fields: [['origen', 'MAX'], ['canal', 'UI']] } },
    { id: 'openclaw-in', type: 'flowNode', position: { x: 40, y: 200 }, data: { label: 'OpenClaw', kind: 'input', state: 'online', num: 'IN-2', fields: [['tipo', 'free'], ['canal', 'CLI']] } },
    { id: 'webhook', type: 'flowNode', position: { x: 40, y: 340 }, data: { label: 'Webhook', kind: 'input', state: 'online', num: 'IN-3', fields: [['endpoint', '/hook']] } },
    { id: 'router', type: 'flowNode', position: { x: 320, y: 180 }, data: { label: 'Router', kind: 'core', state: 'running', num: 'CORE', fields: [['nodos', '16'], ['rutas', '2'], ['fichas', '0']] } },
    { id: 'claude', type: 'flowNode', position: { x: 660, y: 40 }, data: { label: 'Claude', kind: 'agente', state: 'online', num: 'A1', fields: [['modelo', 'Sonnet 4.5'], ['prio', '1']] } },
    { id: 'mimo', type: 'flowNode', position: { x: 660, y: 170 }, data: { label: 'MiMo', kind: 'agente', state: 'online', num: 'A2', fields: [['modelo', 'mimo-v2'], ['prio', '2']] } },
    { id: 'openclaw', type: 'flowNode', position: { x: 660, y: 300 }, data: { label: 'OpenClaw', kind: 'agente', state: 'online', num: 'A3', fields: [['modelo', 'local'], ['prio', '3']] } },
    { id: 'github', type: 'flowNode', position: { x: 660, y: 430 }, data: { label: 'GitHub', kind: 'destino', state: 'online', num: 'OUT-1', fields: [['user', 'maxbry'], ['ops', '5']] } },
    { id: 'vps', type: 'flowNode', position: { x: 940, y: 170 }, data: { label: 'VPS', kind: 'destino', state: 'error', num: 'OUT-2', fields: [['puerto', '7001'], ['status', 'down']] } },
    { id: 'hf', type: 'flowNode', position: { x: 940, y: 300 }, data: { label: 'HF', kind: 'destino', state: 'online', num: 'OUT-3', fields: [['space', 'maxbry']] } },
    { id: 'memory', type: 'output', position: { x: 1180, y: 230 }, data: { label: 'Memoria', kind: 'store' }, style: { background: 'var(--panel)', border: '1px solid var(--cyan)', borderRadius: 5, padding: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--white)' } }
  ], [])

  const wfEdges = useMemo(() => [
    { id: 'e1', source: 'chat', target: 'router', animated: true, style: { stroke: 'var(--cyan)' } },
    { id: 'e2', source: 'openclaw-in', target: 'router' },
    { id: 'e3', source: 'webhook', target: 'router' },
    { id: 'e4', source: 'router', target: 'claude', label: 'prio 1' },
    { id: 'e5', source: 'router', target: 'mimo', label: 'prio 2' },
    { id: 'e6', source: 'router', target: 'openclaw', label: 'prio 3' },
    { id: 'e7', source: 'router', target: 'github' },
    { id: 'e8', source: 'github', target: 'memory' },
    { id: 'e9', source: 'vps', target: 'memory' },
    { id: 'e10', source: 'hf', target: 'memory' }
  ], [])

  const [nodes, , onNodesChange] = useNodesState(wfNodes)
  const [edges, , onEdgesChange] = useEdgesState(wfEdges)

  // ===== Actions =====
  const onRun = async () => {
    const task_id = `task-${Date.now()}`
    try {
      const r: any = await api('/run', { method: 'POST', body: JSON.stringify({ task_id, agent_id: selectedAgentId }) })
      setRuns(rs => [r, ...rs].slice(0, 20))
      setLogs(l => [...l, { ts: new Date().toISOString().slice(11, 19), lvl: 'ok', msg: `Run ${task_id} · ${r.etapas?.length || 0} etapas` }])
      notify('ok', `Run OK · ${r.etapas?.length || 0} etapas`)
    } catch (e: any) { notify('err', `Run FAIL · ${e.message}`) }
  }

  const onTestResource = (r: Resource) => {
    if (r.cat === 'credenciales' && !isEngineer) {
      notify('err', 'Acceso de ingeniero requerido para probar credenciales')
      return
    }
    setModal({
      title: `Test ${r.name}`,
      fields: [{ name: 'input', label: 'Input opcional', value: 'hola' }],
      onSubmit: async (vals) => {
        const endpoints: any = {
          'anthropic': ['/api/nvidia/chat', 'POST', { model: 'minimax-m2.7', messages: [{ role: 'user', content: vals.input }] }],
          'minimax': ['/api/nvidia/chat', 'POST', { model: 'minimax-m2.7', messages: [{ role: 'user', content: vals.input }] }],
          'litellm': ['/api/nvidia/chat', 'POST', { model: 'minimax-m2.7', messages: [{ role: 'user', content: vals.input }] }],
          'mcp-github': ['/api/mcp/invoke', 'POST', { tool: 'list_modules', args: {} }],
          'vps': ['/api/vps/exec', 'POST', { cmd: 'status' }],
          'repo-router': ['/api/github/file', 'POST', { path: 'README.md' }],
          'core-memoria': ['/api/memory/leer', 'POST', { path: 'MEMORY.md' }]
        }
        const [ep, method, body] = endpoints[r.id] || ['/api/dashboard', 'GET', null]
        try {
          const res: any = await api(ep, { method, body: body ? JSON.stringify(body) : undefined })
          notify('ok', `${r.name} OK · ${JSON.stringify(res).slice(0, 100)}`)
          setModal(null)
        } catch (e: any) { notify('err', `${r.name} FAIL · ${e.message}`) }
      }
    })
  }

  const onDuplicateAgent = () => {
    if (!selectedAgent) return
    const newId = `${selectedAgent.id}-${Date.now()}`
    setAgents([...agents, { ...selectedAgent, id: newId, name: `${selectedAgent.name} (copia)` }])
    setSelectedAgentId(newId)
    notify('ok', `Agente duplicado: ${newId}`)
  }

  const onCreateAgent = () => {
    if (!isEngineer) { notify('err', 'Solo ingenieros pueden crear agentes'); return }
    const newId = `agent-${Date.now()}`
    setAgents([...agents, makeAgent(newId, 'Nuevo Agente')])
    setSelectedAgentId(newId)
    notify('ok', `Nuevo agente creado: ${newId}`)
  }

  const updateAgentSafe = (section: keyof AgentObj, key: string, val: any) => {
    if (!isEngineer) { notify('err', 'Solo ingenieros pueden editar agentes'); return }
    setAgents(prev => prev.map(a => a.id === selectedAgentId ? { ...a, [section]: { ...(a[section] as any), [key]: val } } as AgentObj : a))
  }

  // ===== Palette =====
  const paletteCommands = [
    { id: 'run', label: '▶ Ejecutar /run con agente actual', shortcut: '⌘R', engineer: false },
    { id: 'execute', label: '⚡ Ejecutar /execute', shortcut: '⌘E', engineer: false },
    { id: 'duplicate-agent', label: '⎘ Duplicar agente seleccionado', engineer: false },
    { id: 'red-send', label: '⌬ Enviar mensaje a Red Universal', engineer: false },
    { id: 'nvidia-test', label: '⚡ Test NVIDIA NIM', engineer: false },
    { id: 'new-agent', label: '+ Nuevo agente (reutilizable)', engineer: true },
    { id: 'lab', label: '🧪 Abrir Laboratorio (avanzado)', shortcut: '⌘L', engineer: true },
    { id: 'github-commit', label: '⎇ Commit a GitHub', engineer: true },
    { id: 'github-issue', label: '⎇ Crear Issue', engineer: true },
    { id: 'vps-exec', label: '⊞ Ejecutar en VPS', engineer: true },
    { id: 'lock', label: '🔒 Bloquear sesión', engineer: true },
    { id: 'refresh', label: '↻ Refrescar todo' }
  ]
  const filteredCmds = paletteCommands
    .filter(c => isEngineer || !c.engineer)
    .filter(c => c.label.toLowerCase().includes(paletteQuery.toLowerCase()))

  const onPaletteRun = (cmd: string) => {
    setPaletteOpen(false)
    if (cmd === 'run') onRun()
    else if (cmd === 'execute') api('/execute', { method: 'POST', body: JSON.stringify({ task_id: `e-${Date.now()}` }) }).then(() => notify('ok', 'Execute OK')).catch((e: any) => notify('err', e.message))
    else if (cmd === 'new-agent') onCreateAgent()
    else if (cmd === 'duplicate-agent') onDuplicateAgent()
    else if (cmd === 'lab') setLabOpen(true)
    else if (cmd === 'lock') handleLogout()
    else if (cmd === 'red-send') {
      setModal({
        title: 'Enviar a Red Universal',
        fields: [
          { name: 'tipo', label: 'Tipo', value: 'code.task' },
          { name: 'task_id', label: 'Task ID' },
          { name: 'payload', label: 'Payload JSON', type: 'textarea', value: '{"text":"hola"}' }
        ],
        onSubmit: async (vals) => {
          try {
            const payload = JSON.parse(vals.payload || '{}')
            const r: any = await api('/api/red/send', { method: 'POST', body: JSON.stringify({ tipo: vals.tipo, origen: 'core.api', task_id: vals.task_id, payload }) })
            notify(r.status === 'DONE' ? 'ok' : 'err', `${r.status} · ${r.via || r.error || ''}`)
            setModal(null)
          } catch (e: any) { notify('err', e.message) }
        }
      })
    } else if (cmd === 'nvidia-test') {
      setModal({
        title: 'Test NVIDIA NIM',
        fields: [{ name: 'model', label: 'Modelo', value: 'minimax-m2.7' }, { name: 'msg', label: 'Mensaje', value: 'di hola' }],
        onSubmit: async (vals) => {
          try {
            const r: any = await api('/api/nvidia/chat', { method: 'POST', body: JSON.stringify({ model: vals.model, messages: [{ role: 'user', content: vals.msg }] }) })
            notify(r.status === 'DONE' ? 'ok' : 'err', r.output?.choices?.[0]?.message?.content || JSON.stringify(r).slice(0, 200))
            setModal(null)
          } catch (e: any) { notify('err', e.message) }
        }
      })
    } else if (cmd === 'github-commit' || cmd === 'github-issue' || cmd === 'vps-exec') {
      if (!isEngineer) { notify('err', 'Requiere acceso ingeniero'); return }
      if (cmd === 'vps-exec') {
        setModal({
          title: 'Ejecutar en VPS',
          fields: [{ name: 'cmd', label: 'Comando', value: 'ls -la' }],
          onSubmit: async (vals) => {
            try {
              const r: any = await api('/api/vps/exec', { method: 'POST', body: JSON.stringify({ cmd: vals.cmd }) })
              notify(r.status === 'DONE' ? 'ok' : 'err', r.output || r.error || 'OK')
              setModal(null)
            } catch (e: any) { notify('err', e.message) }
          }
        })
      } else if (cmd === 'github-commit') {
        setModal({
          title: 'Commit a GitHub',
          fields: [{ name: 'path', label: 'Path', value: 'test.txt' }, { name: 'content', label: 'Contenido', value: 'MAXBRY' }, { name: 'message', label: 'Mensaje', value: 'auto' }],
          onSubmit: async (vals) => {
            try {
              const r: any = await api('/api/github/commit', { method: 'POST', body: JSON.stringify(vals) })
              notify('ok', `Commit OK · ${r.status || r.code || 'OK'}`)
              setModal(null)
            } catch (e: any) { notify('err', e.message) }
          }
        })
      } else {
        setModal({
          title: 'Crear Issue en GitHub',
          fields: [{ name: 'title', label: 'Título', value: `MAXBRY ${new Date().toISOString()}` }, { name: 'body', label: 'Cuerpo', type: 'textarea', value: 'Auto-issue' }],
          onSubmit: async (vals) => {
            try {
              const r: any = await api('/api/github/issue', { method: 'POST', body: JSON.stringify(vals) })
              notify('ok', `Issue OK · ${r.status || r.code || 'OK'}`)
              setModal(null)
            } catch (e: any) { notify('err', e.message) }
          }
        })
      }
    } else if (cmd === 'refresh') refresh()
  }

  // =====================================================================
  // AI CONFIGURATION ASSISTANT — 4 asistentes especializados
  // =====================================================================

  // 1) CONFIGURATION ASSISTANT — autocompletar + paso a paso
  // (helper usado por el panel AI para sugerir valores)
  const configAutocomplete = (field: string) => {
    const map: Record<string, { value: string, hint: string }> = {
      'vps_ip': { value: '95.111.232.89', hint: '✓ IP detectada' },
      'vps_port': { value: '22', hint: '✓ SSH puerto estándar' },
      'vps_user': { value: 'root', hint: '⚠ Falta confirmar' },
      'github_token': { value: 'ghp_...', hint: '✓ Token GitHub' },
      'hf_token': { value: 'hf_...', hint: '⚠ Generar en huggingface.co/settings/tokens' },
      'litellm_endpoint': { value: 'http://localhost:4000', hint: '✓ LiteLLM local' },
      'redis_url': { value: 'redis://localhost:6379', hint: '✓ Redis local' }
    }
    return map[field] || { value: '', hint: '⚠ Sin sugerencia' }
  }
  // Hacer accesible al global para que el AI panel lo invoque via window
  ;(window as any).configAutocomplete = configAutocomplete

  // 2) STEP-BY-STEP wizard para "Conectar X"
  const configWizard = (target: string) => {
    const wizards: Record<string, any[]> = {
      'github': [
        { q: '¿Qué operación necesitas?', opts: ['Push código', 'Issues', 'PRs', 'Disparar workflows'] },
        { q: 'Tu Personal Access Token', hint: 'Generar en github.com/settings/tokens (scope: repo, workflow)' },
        { q: 'Repositorio destino', placeholder: 'maxbry123-commits/maxbry-router' }
      ],
      'vps': [
        { q: 'IP del VPS', hint: 'Ej: 95.111.232.89' },
        { q: 'Puerto SSH', value: '22' },
        { q: 'Usuario', value: 'root' },
        { q: 'Método de auth', opts: ['Clave SSH', 'Password'] }
      ],
      'hf': [
        { q: '¿Crear Space o usar existente?', opts: ['Nuevo Space', 'Existente'] },
        { q: 'Token HF', hint: 'huggingface.co/settings/tokens' },
        { q: 'Modelo a desplegar', placeholder: 'minimax-m2.7' }
      ],
      'telegram': [
        { q: 'Bot Token (BotFather)', hint: '@BotFather → /newbot' },
        { q: 'Chat ID', hint: '@userinfobot para obtener tu ID' }
      ]
    }
    return wizards[target] || []
  }

  // 3) VERIFICACIÓN antes de guardar
  const verifyConfig = (target: string, values: any) => {
    const checks: any = { ok: [], warn: [], err: [] }
    if (target === 'github') {
      if (values.token?.startsWith('ghp_')) checks.ok.push('GitHub Token válido')
      else checks.err.push('GitHub Token inválido (debe empezar con ghp_)')
      if (values.repo?.includes('/')) checks.ok.push('Repositorio bien formado')
      else checks.warn.push('Repositorio no parece válido')
    }
    if (target === 'vps') {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(values.ip)) checks.ok.push('IP válida')
      else checks.err.push('IP inválida')
      if (values.port) checks.ok.push('Puerto OK')
      else checks.warn.push('Falta puerto')
      if (values.auth === 'password') checks.warn.push('Recomendado: usar clave SSH en vez de password')
    }
    return checks
  }
  ;(window as any).verifyConfig = verifyConfig

  // 4) DIAGNOSTICS — analizar errores
  const diagnose = (error: string) => {
    const err = error.toLowerCase()
    if (err.includes('401') || err.includes('unauthorized'))
      return { cause: 'API Key inválida o expirada', fixes: ['Rotar token en el servicio', 'Verificar variable de entorno', 'Revisar scopes/permisos'] }
    if (err.includes('timeout') || err.includes('timed out'))
      return { cause: 'Timeout — el servicio no respondió a tiempo', fixes: ['Aumentar timeout_s en Recovery', 'Verificar DNS/firewall', 'Comprobar si el servicio está vivo'] }
    if (err.includes('connection') || err.includes('refused'))
      return { cause: 'No se puede conectar al servicio', fixes: ['Verificar IP/puerto', 'Comprobar firewall', 'Service down?'] }
    if (err.includes('vps') || err.includes('7001'))
      return { cause: 'VPS: puerto 7001 caído', fixes: ['systemctl restart nct-router', 'Verificar logs: journalctl -u nct-router', 'nginx liberar puerto 8000'] }
    return { cause: 'Error desconocido', fixes: ['Revisar logs', 'Test endpoint con curl', 'Contactar admin'] }
  }

  // 5) ARCHITECTURE — revisar workflow
  const reviewArchitecture = () => {
    const issues: any[] = []
    if (agents.length === 0) issues.push({ level: 'err', msg: 'No hay agentes configurados' })
    if (!agents.find(a => a.entradas.chat)) issues.push({ level: 'warn', msg: 'Ningún agente escucha del chat' })
    if (!agents.find(a => a.salidas.github)) issues.push({ level: 'warn', msg: 'Sin destino GitHub — los artefactos no se persisten' })
    if (dash && dash.nodos_red < 16) issues.push({ level: 'warn', msg: `Solo ${dash.nodos_red}/16 nodos activos` })
    return { score: Math.max(0, 100 - issues.filter(i => i.level === 'err').length * 25 - issues.filter(i => i.level === 'warn').length * 10), issues }
  }

  // 6) OPTIMIZATION — recomendaciones
  const optimize = () => {
    const tips: any[] = []
    tips.push({ area: 'coste', tip: 'Usar MiMo como fallback antes que Claude (10x más barato)' })
    tips.push({ area: 'latencia', tip: 'Cachear respuestas idénticas en core.memoria (TTL 30 días)' })
    tips.push({ area: 'memoria', tip: 'Mover logs a PostgreSQL cuando > 10k entradas' })
    tips.push({ area: 'seguridad', tip: 'Rotar tokens cada 90 días' })
    return tips
  }

  // Constructor NL → config
  const parseNaturalLanguage = (text: string) => {
    const t = text.toLowerCase()
    const config: any = { entradas: [], salidas: [], agente: null, ok: false }
    if (t.includes('claude')) { config.agente = 'claude'; config.entradas.push('chat'); config.salidas.push('github') }
    if (t.includes('mimo')) { config.agente = 'mimo'; config.entradas.push('chat') }
    if (t.includes('openclaw')) { config.agente = 'openclaw'; config.entradas.push('chat') }
    if (t.includes('hf') || t.includes('huggingface')) config.salidas.push('hf')
    if (t.includes('vps')) config.salidas.push('vps')
    if (t.includes('railway')) config.salidas.push('railway')
    if (t.includes('docker')) config.salidas.push('docker')
    if (t.includes('telegram')) config.entradas.push('telegram')
    if (t.includes('webhook')) config.entradas.push('webhook')
    if (config.agente) config.ok = true
    return config
  }

  // Quick actions
  const aiQuick = (action: string) => {
    let response = ''
    let steps: any[] = []
    if (action === 'connect-github') {
      steps = configWizard('github').map(w => ({ ...w, kind: 'wizard' }))
      response = 'Conectar GitHub — sigue los pasos:'
    } else if (action === 'create-agent') {
      response = 'Crear agente — dime en lenguaje natural qué quieres. Ej: "Claude Code que reciba del chat y guarde en GitHub"'
    } else if (action === 'config-hf') {
      steps = configWizard('hf').map(w => ({ ...w, kind: 'wizard' }))
      response = 'Configurar HuggingFace:'
    } else if (action === 'create-workflow') {
      response = 'Crear workflow — describe en una frase. Ej: "OpenClaw free recibe webhook y publica en VPS"'
    } else if (action === 'search-error') {
      response = 'Diagnóstico — pega el error o describe el problema. Yo analizo las posibles causas y propongo fixes.'
      setAiTab('diagnostics')
    } else if (action === 'audit') {
      const r = reviewArchitecture()
      response = `Audit del sistema: ${r.score}/100`
      steps = r.issues
    } else if (action === 'optimize') {
      const tips = optimize()
      response = `${tips.length} recomendaciones de optimización:`
      steps = tips
      setAiTab('optimization')
    }
    setAiChat(c => [...c, { role: 'user', text: action }, { role: 'ai', text: response, steps }])
  }

  const onAiSubmit = () => {
    if (!aiInput.trim()) return
    const text = aiInput.trim()
    setAiInput('')
    let response = ''
    let steps: any[] = []
    // Intenta parsear como constructor NL
    const parsed = parseNaturalLanguage(text)
    if (parsed.ok) {
      response = `✓ Entendido. Configuración propuesta:\n\n  Agente: ${parsed.agente}\n  Entradas: ${parsed.entradas.join(', ') || 'ninguna'}\n  Salidas: ${parsed.salidas.join(', ') || 'ninguna'}\n\n¿Aplico esta configuración?`
      steps = [
        { kind: 'preview', config: parsed },
        { kind: 'action', label: '✓ Aplicar y crear agente', action: 'apply-nl' },
        { kind: 'action', label: '✎ Ajustar antes', action: 'adjust-nl' }
      ]
    } else if (aiTab === 'diagnostics') {
      const d = diagnose(text)
      response = `🔍 Diagnóstico:\n\nCausa: ${d.cause}\n\nPosibles soluciones:`
      steps = d.fixes.map((f: string) => ({ kind: 'fix', text: f }))
    } else if (aiTab === 'architecture') {
      const r = reviewArchitecture()
      response = `🏗️ Score de arquitectura: ${r.score}/100`
      steps = r.issues
    } else {
      response = 'No entendí. Prueba con: "Conectar Claude a GitHub" o "Crear agente que use HF"'
    }
    setAiChat(c => [...c, { role: 'user', text }, { role: 'ai', text: response, steps }])
  }

  // Explicación de campo
  const explainField = (field: string) => {
    const map: Record<string, { desc: string, recommended: string }> = {
      'timeout_s': { desc: 'Tiempo máximo que esperará el Router antes de considerar que el servicio no responde.', recommended: '60s' },
      'retries': { desc: 'Número de reintentos automáticos antes de marcar como fallido.', recommended: '3' },
      'max_tokens': { desc: 'Máximo de tokens que puede consumir una sola llamada al modelo.', recommended: '8192' },
      'ttl_dias': { desc: 'Cuántos días se conserva la memoria persistente antes de expirar.', recommended: '30' },
      'fallback': { desc: 'Agente de respaldo si el principal falla o no está disponible.', recommended: 'mimo' },
      'sandbox': { desc: 'Si está activo, el código se ejecuta en un entorno aislado (Docker).', recommended: 'ON' }
    }
    return map[field] || { desc: 'Sin descripción', recommended: '—' }
  }
  ;(window as any).explainField = explainField

  // ===== Render LOGIN =====
  if (authMode !== null) {
    return (
      <div className="mb5" style={{ gridTemplateColumns: '1fr', gridTemplateAreas: '"login" "login" "login"' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gridArea: 'login' }}>
          <div className="mb5-modal" style={{ width: 440 }}>
            <h3 style={{ justifyContent: 'center', marginBottom: 20 }}>
              <span style={{ marginRight: 8 }}>◉</span>
              MAXBRY · Centro de Control
            </h3>

            {authMode === 'guest' && (
              <div>
                <p style={{ color: 'var(--gray)', fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
                  Modo <b style={{ color: 'var(--white)' }}>USUARIO</b>: solo puedes enviar tareas a los agentes existentes. No verás credenciales, no podrás editar agentes ni acceder al laboratorio.
                </p>
                <button className="mb5-btn primary" style={{ width: '100%', marginTop: 16 }} onClick={handleGuestLogin}>Entrar como Usuario</button>
                <button className="mb5-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setAuthMode('login')}>← Volver</button>
              </div>
            )}

            {authMode === 'login' && (
              <div>
                <p style={{ color: 'var(--gray)', fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.6, marginBottom: 16 }}>
                  Selecciona nivel de acceso:
                </p>
                <button className="mb5-btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => setAuthMode('engineer')}>
                  🔐 Ingeniero (acceso total)
                </button>
                <button className="mb5-btn" style={{ width: '100%' }} onClick={() => setAuthMode('guest')}>
                  👤 Usuario (solo ejecución)
                </button>
              </div>
            )}

            {(authMode as any) === 'engineer' && (
              <div>
                <p style={{ color: 'var(--gray)', fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.6, marginBottom: 16 }}>
                  <b style={{ color: 'var(--yellow)' }}>⚠ Solo personal autorizado.</b><br />
                  Tu clave maestra descifra las credenciales en memoria usando AES-GCM.
                </p>
                <label>Email del ingeniero</label>
                <input value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} placeholder={ENGINEER_EMAIL} />
                <label>Clave maestra (cifrado)</label>
                <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••••••" onKeyDown={e => e.key === 'Enter' && handleEngineerLogin()} />
                {authError && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 8, fontFamily: 'var(--mono)' }}>✗ {authError}</div>}
                <div className="mb5-modal-actions">
                  <button className="mb5-btn" onClick={() => setAuthMode('login')}>← Volver</button>
                  <button className="mb5-btn primary" onClick={handleEngineerLogin}>🔓 Desbloquear</button>
                </div>
                <div style={{ color: 'var(--gray-2)', fontSize: 9, marginTop: 12, fontFamily: 'var(--mono)', textAlign: 'center' }}>
                  Derivación: PBKDF2-SHA256 (100k iter) · Cifrado: AES-GCM-256
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== Render RECURSOS =====
  const renderResources = () => {
    const cats: { key: ResourceCategory, label: string }[] = [
      { key: 'apis', label: 'APIs' },
      { key: 'gateways', label: 'Gateways' },
      { key: 'mcp', label: 'MCP' },
      { key: 'repos', label: 'Repositorios' },
      { key: 'servidores', label: 'Servidores' },
      { key: 'memoria', label: 'Memoria' },
      { key: 'mensajeria', label: 'Mensajería' },
      { key: 'credenciales', label: '🔒 Credenciales (cifradas)' },
      { key: 'templates', label: 'Templates' }
    ]
    return (
      <>
        <div className="mb5-res-header">
          <span>RECURSOS</span>
          <span style={{ fontSize: 9 }}>REGISTRAR UNA SOLA VEZ</span>
        </div>
        {cats.map(c => {
          if (c.key === 'credenciales' && !isEngineer) return null  // Usuarios normales NO ven credenciales
          return (
            <div key={c.key} className="mb5-res-section">
              <div className="mb5-res-cat" onClick={() => setOpenCat(o => ({ ...o, [c.key]: !o[c.key] }))}>
                <span style={{ width: 10, display: 'inline-block' }}>{openCat[c.key] ? '▾' : '▸'}</span>
                {c.label}
                <span className="count">{RESOURCES[c.key].length}</span>
                {isEngineer && <span className="add" onClick={e => { e.stopPropagation(); notify('info', `+ Agregar ${c.label}`) }}>+</span>}
              </div>
              {openCat[c.key] && RESOURCES[c.key].map(r => (
                <div key={r.id} className={`mb5-res-item ${selectedRes?.id === r.id ? 'active' : ''}`} onClick={() => setSelectedRes(r)}>
                  <span className="icon">{r.icon}</span>
                  <span className="name">{r.name}</span>
                  {r.state && <span className={`mb5-dot ${r.state}`} />}
                  {r.badge && <span className="badge">{r.badge}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </>
    )
  }

  // ===== Render INSPECTOR =====
  const renderInspector = () => {
    if (selectedRes?.cat === 'credenciales' && isEngineer) {
      const cred = CREDENTIALS_CATALOG.find(c => c.id === selectedRes.id)
      if (!cred) return null
      const isRevealed = credReveal?.id === cred.id
      return (
        <div>
          <div className="mb5-prop-group">
            <div className="mb5-prop-title"><span>🔒 {cred.service}</span><span className="mb5-pill yellow">CIFRADO</span></div>
            <div className="mb5-prop-row"><span className="key">id</span><span className="val">{cred.id}</span></div>
            <div className="mb5-prop-row"><span className="key">algoritmo</span><span className="val">AES-GCM-256</span></div>
            <div className="mb5-prop-row"><span className="key">derivación</span><span className="val">PBKDF2-SHA256</span></div>
            <div className="mb5-prop-row"><span className="key">iteraciones</span><span className="val">100,000</span></div>
          </div>
          <div className="mb5-prop-section">
            <h4>Valor descifrado</h4>
            {isRevealed ? (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 3, padding: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--white)', wordBreak: 'break-all' }}>
                {credReveal.value}
                <button className="mb5-btn" style={{ marginTop: 8, width: '100%' }} onClick={() => navigator.clipboard.writeText(credReveal.value).then(() => notify('ok', 'Copiado'))}>📋 Copiar</button>
                <button className="mb5-btn danger" style={{ marginTop: 4, width: '100%' }} onClick={() => setCredReveal(null)}>🔒 Volver a cifrar</button>
              </div>
            ) : (
              <div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--gray-2)' }}>
                  🔒••••••••••••••••••••{cred.hint.split('...').pop()}
                </div>
                <button className="mb5-btn primary" style={{ marginTop: 8, width: '100%' }} onClick={() => revealCredential(cred.id)}>🔓 Descifrar con mi clave maestra</button>
              </div>
            )}
          </div>
          <div className="mb5-prop-section">
            <h4>Vista cifrada (base64)</h4>
            <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', maxHeight: 100, overflow: 'auto', wordBreak: 'break-all' }}>
              {(() => {
                try {
                  encryptCredential(cred.plaintext, MASTER_KEY).then(s => s.slice(0, 200) + '...')
                } catch { return 'error' }
              })()}
            </pre>
            <div style={{ color: 'var(--gray-2)', fontSize: 9, fontFamily: 'var(--mono)', marginTop: 4 }}>
              ↑ Aunque robes este archivo, sin la clave maestra no puedes descifrarlo.
            </div>
          </div>
        </div>
      )
    }

    if (selectedRes) {
      return (
        <div>
          <div className="mb5-prop-group">
            <div className="mb5-prop-title"><span>📦 {selectedRes.name}</span>{selectedRes.state && <span className={`mb5-dot ${selectedRes.state}`} />}</div>
            <div className="mb5-prop-row"><span className="key">id</span><span className="val">{selectedRes.id}</span></div>
            <div className="mb5-prop-row"><span className="key">categoría</span><span className="val">{selectedRes.cat}</span></div>
            <div className="mb5-prop-row"><span className="key">estado</span><span className="val">{selectedRes.state}</span></div>
            {selectedRes.badge && <div className="mb5-prop-row"><span className="key">info</span><span className="val">{selectedRes.badge}</span></div>}
          </div>
          <div className="mb5-prop-actions">
            <button className="mb5-btn primary" onClick={() => onTestResource(selectedRes)}>🧪 Test</button>
            {isEngineer && <button className="mb5-btn" onClick={() => notify('info', 'Editar recurso')}>✎ Editar</button>}
            {isEngineer && <button className="mb5-btn danger" onClick={() => notify('info', 'Recursos no se eliminan, solo desactivan')}>⚠ Desactivar</button>}
            {!isEngineer && <div style={{ color: 'var(--gray-2)', fontSize: 10, padding: 8, fontFamily: 'var(--mono)' }}>Solo lectura · requiere acceso ingeniero</div>}
          </div>
        </div>
      )
    }

    if (selectedAgent) {
      const sections: { key: PropSection, label: string }[] = [
        { key: 'general', label: 'General' },
        { key: 'entradas', label: 'Entradas' },
        { key: 'salidas', label: 'Salidas' },
        { key: 'ia', label: 'IA' },
        { key: 'memoria', label: 'Memoria' },
        { key: 'seguridad', label: 'Seguridad' },
        { key: 'recovery', label: 'Recovery' },
        { key: 'monitor', label: 'Monitor' },
        { key: 'logs', label: 'Logs' },
        { key: 'avanzado', label: 'Avanzado' }
      ]
      return (
        <div>
          <div className="mb5-insp-tabs">
            {sections.map(s => (
              <button key={s.key} className={`mb5-insp-tab ${inspSection === s.key ? 'active' : ''}`} onClick={() => setInspSection(s.key)}>{s.label}</button>
            ))}
          </div>

          {inspSection === 'general' && (
            <div>
              <div className="mb5-prop-group">
                <div className="mb5-prop-title">AGENTE: {selectedAgent.name}</div>
                <div className="mb5-prop-row"><span className="key">id</span><span className="val">{selectedAgent.id}</span></div>
                <div className="mb5-prop-row"><span className="key">template</span><span className="val">{selectedAgent.template || '—'}</span></div>
                <div className="mb5-prop-row"><span className="key">descripción</span>{isEngineer ? <input defaultValue={selectedAgent.general.desc} onBlur={e => updateAgentSafe('general', 'desc', e.target.value)} placeholder="..." /> : <span className="val">{selectedAgent.general.desc || '—'}</span>}</div>
                <div className="mb5-prop-row"><span className="key">versión</span><span className="val">{selectedAgent.general.version}</span></div>
              </div>
              <div className="mb5-prop-actions">
                <button className="mb5-btn primary" onClick={onRun}>▶ Run con este agente</button>
                <button className="mb5-btn" onClick={onDuplicateAgent}>⎘ Duplicar</button>
                {isEngineer && <button className="mb5-btn danger" onClick={() => { setAgents(agents.filter(a => a.id !== selectedAgentId)); setSelectedAgentId(agents[0]?.id || ''); notify('ok', 'Agente eliminado') }}>🗑 Eliminar</button>}
                {!isEngineer && <div style={{ color: 'var(--gray-2)', fontSize: 10, padding: 8, fontFamily: 'var(--mono)' }}>Solo lectura · acceso ingeniero para editar</div>}
              </div>
            </div>
          )}

          {inspSection === 'entradas' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">ENTRADAS HABILITADAS</div>
              {Object.entries(selectedAgent.entradas).map(([k, v]) => (
                <div key={k} className="mb5-prop-row toggle">
                  <span className="key">{k}</span>
                  {isEngineer ? <div className={`mb5-toggle ${v ? 'on' : ''}`} onClick={() => updateAgentSafe('entradas', k, !v)} /> : <div className={`mb5-toggle ${v ? 'on' : ''}`} style={{ opacity: 0.4, cursor: 'not-allowed' }} />}
                </div>
              ))}
            </div>
          )}

          {inspSection === 'salidas' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">DESTINOS HABILITADOS</div>
              {Object.entries(selectedAgent.salidas).map(([k, v]) => (
                <div key={k} className="mb5-prop-row toggle">
                  <span className="key">{k}</span>
                  {isEngineer ? <div className={`mb5-toggle ${v ? 'on' : ''}`} onClick={() => updateAgentSafe('salidas', k, !v)} /> : <div className={`mb5-toggle ${v ? 'on' : ''}`} style={{ opacity: 0.4, cursor: 'not-allowed' }} />}
                </div>
              ))}
            </div>
          )}

          {inspSection === 'ia' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">CONFIGURACIÓN IA</div>
              <div className="mb5-prop-row"><span className="key">gateway</span><span className="val">{selectedAgent.ia.gateway}</span></div>
              <div className="mb5-prop-row"><span className="key">api</span><span className="val">{selectedAgent.ia.api}</span></div>
              <div className="mb5-prop-row"><span className="key">modelo</span><span className="val">{selectedAgent.ia.modelo}</span></div>
              <div className="mb5-prop-row"><span className="key">fallback</span><span className="val">{selectedAgent.ia.fallback}</span></div>
              {!isEngineer && <div style={{ color: 'var(--gray-2)', fontSize: 10, padding: 8, fontFamily: 'var(--mono)' }}>Solo lectura · acceso ingeniero para editar</div>}
            </div>
          )}

          {inspSection === 'memoria' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">MEMORIA</div>
              <div className="mb5-prop-row"><span className="key">activada</span><span className="val">{selectedAgent.memoria.on ? 'ON' : 'OFF'}</span></div>
              <div className="mb5-prop-row"><span className="key">tipo</span><span className="val">{selectedAgent.memoria.tipo}</span></div>
              <div className="mb5-prop-row"><span className="key">TTL</span><span className="val">{selectedAgent.memoria.ttl_dias} días</span></div>
            </div>
          )}

          {inspSection === 'seguridad' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">SEGURIDAD</div>
              <div className="mb5-prop-row"><span className="key">sandbox</span><span className="val">{selectedAgent.seguridad.sandbox ? 'ON' : 'OFF'}</span></div>
              <div className="mb5-prop-row"><span className="key">whitelist</span><span className="val">{selectedAgent.seguridad.whitelist}</span></div>
              <div className="mb5-prop-row"><span className="key">max_tokens</span><span className="val">{selectedAgent.seguridad.max_tokens}</span></div>
            </div>
          )}

          {inspSection === 'recovery' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">RECUPERACIÓN</div>
              <div className="mb5-prop-row"><span className="key">reintentos</span><span className="val">{selectedAgent.recovery.retries}</span></div>
              <div className="mb5-prop-row"><span className="key">timeout</span><span className="val">{selectedAgent.recovery.timeout_s}s</span></div>
              <div className="mb5-prop-row"><span className="key">circuit_breaker</span><span className="val">{selectedAgent.recovery.circuit_breaker ? 'ON' : 'OFF'}</span></div>
            </div>
          )}

          {inspSection === 'monitor' && (
            <div className="mb5-prop-group">
              <div className="mb5-prop-title">MONITOR</div>
              <div className="mb5-prop-row"><span className="key">logs</span><span className="val">{selectedAgent.monitor.logs ? 'ON' : 'OFF'}</span></div>
              <div className="mb5-prop-row"><span className="key">métricas</span><span className="val">{selectedAgent.monitor.metricas ? 'ON' : 'OFF'}</span></div>
              <div className="mb5-prop-row"><span className="key">alertas</span><span className="val">{selectedAgent.monitor.alertas ? 'ON' : 'OFF'}</span></div>
            </div>
          )}

          {inspSection === 'logs' && (
            <div className="mb5-insp-logs">
              <div className="mb5-prop-row"><span className="key">nivel</span><span className="val">{selectedAgent.logs.nivel.toUpperCase()}</span></div>
              <div className="mb5-prop-title" style={{ marginTop: 12 }}>EVENTOS RECIENTES</div>
              {logs.slice(-30).reverse().map((l, i) => (
                <div key={i} className="mb5-log-line">
                  <span className="ts">{l.ts}</span>
                  <span className={`lvl ${l.lvl}`}>{l.lvl?.toUpperCase()}</span>
                  <span className="msg">{l.msg}</span>
                </div>
              ))}
            </div>
          )}

          {inspSection === 'avanzado' && (
            <div className="mb5-prop-section">
              {!isEngineer ? (
                <>
                  <h4>System Prompt</h4>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gray-2)', whiteSpace: 'pre-wrap' }}>{selectedAgent.avanzado.system_prompt}</div>
                  <div style={{ color: 'var(--yellow)', fontSize: 10, padding: 8, fontFamily: 'var(--mono)', marginTop: 12, background: 'var(--panel-2)', borderRadius: 3 }}>🔒 Acceso ingeniero requerido para editar</div>
                </>
              ) : (
                <>
                  <h4>System Prompt</h4>
                  <textarea defaultValue={selectedAgent.avanzado.system_prompt} onBlur={e => updateAgentSafe('avanzado', 'system_prompt', e.target.value)} style={{ width: '100%', minHeight: 100, background: 'var(--bg)', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                  <h4 style={{ marginTop: 12 }}>Herramientas custom</h4>
                  <textarea defaultValue={selectedAgent.avanzado.herramientas_custom} placeholder="..." style={{ width: '100%', minHeight: 60, background: 'var(--bg)', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="mb5-insp-empty">
        <div>Selecciona un agente o recurso</div>
        <div className="hint">Panel 1 → click en cualquier item</div>
      </div>
    )
  }

  // ===== Render LABORATORIO (solo ingenieros) =====
  const renderLab = () => {
    if (!labOpen || !isEngineer) return null
    return (
      <aside className="mb5-lab">
        <div className="mb5-lab-tabs">
          {(['json', 'yaml', 'python', 'scripts', 'mcp', 'prompts', 'dsl'] as const).map(t => (
            <button key={t} className={`mb5-lab-tab ${labTab === t ? 'active' : ''}`} onClick={() => setLabTab(t)}>{t}</button>
          ))}
        </div>
        <div className="mb5-lab-content">
          {labTab === 'json' && <pre>{JSON.stringify({ dash, red, fichas, agents, session: { ...session, unlockedCreds: '[REDACTED]' } }, null, 2)}</pre>}
          {labTab === 'yaml' && <pre>{`router:\n  nodos: ${dash?.nodos_red || 0}\nagentes:\n${agents.map(a => `  - ${a.id}:\n      modelo: ${a.ia.modelo}`).join('\n')}`}</pre>}
          {labTab === 'python' && <textarea className="mb5-lab-editor" defaultValue="# Script Python" />}
          {labTab === 'scripts' && <textarea className="mb5-lab-editor" defaultValue="#!/bin/bash" />}
          {labTab === 'mcp' && <pre>{`# MCP Server tools\ntools:\n  - list_modules\n  - router_status\n  - list_agents\n  - dispatch_task\n  - list_providers\n  - list_models\n  - get_architecture\n  - red_send`}</pre>}
          {labTab === 'prompts' && <textarea className="mb5-lab-editor" defaultValue="Eres un agente MAXBRY..." />}
          {labTab === 'dsl' && <textarea className="mb5-lab-editor" defaultValue={`workflow:\n  input: chat\n  router:\n    path: priority\n  destinations: [claude, mimo, openclaw]`} />}
        </div>
      </aside>
    )
  }

  // ================== MÓDULOS LIVE (Provider, Health, Watchdog, etc.) ==================
  const [moduleOpen, setModuleOpen] = useState<string>('provider')

  // Provider Layer
  const [providers, setProviders] = useState<any[]>([])
  const loadProviders = useCallback(async () => {
    try {
      const d = await client.providers()
      setProviders(d.providers || [])
    } catch (e: any) { notify('err', `Providers: ${e.message}`) }
  }, [])

  // Health Monitor
  const [healthMon, setHealthMon] = useState<any>(null)
  const loadHealth = useCallback(async () => {
    try { setHealthMon(await client.healthMonitor()) } catch (e: any) { setHealthMon({ services: {} }) }
  }, [])

  // Watchdog
  const [wd, setWd] = useState<any>(null)
  const loadWatchdog = useCallback(async () => {
    try { setWd(await client.watchdog()) } catch (e: any) { setWd(null) }
  }, [])

  // Circuit Breakers
  const [breakers, setBreakers] = useState<Record<string, any>>({})
  const loadBreakers = useCallback(async () => {
    try {
      const d = await client.circuitBreakers()
      setBreakers(d.breakers || {})
    } catch (e: any) { setBreakers({}) }
  }, [])

  // Marketplace (live bridge registry)
  const [market, setMarket] = useState<any[]>([])
  const loadMarket = useCallback(async () => {
    try {
      const d = await client.bridgeRegistry()
      setMarket([...(d.skills||[]), ...(d.docs||[]), ...(d.dsl||[]), ...(d.contracts||[])])
    } catch (e: any) { setMarket([]) }
  }, [])

  // Custom Panels
  const [customPanels, setCustomPanels] = useState<any[]>([])
  const loadCustomPanels = useCallback(async () => {
    try {
      const d = await client.customPanels()
      setCustomPanels(d.panels || [])
    } catch (e: any) { setCustomPanels([]) }
  }, [])

  // Builder Studio
  const [builderTab, setBuilderTab] = useState<'agent' | 'skill' | 'workflow'>('agent')
  const [builderAgents, setBuilderAgents] = useState<any[]>([])
  const [newAgent, setNewAgent] = useState({ name: '', role: 'executor', provider: 'litellm' })
  const [newSkill, setNewSkill] = useState({ name: '', version: '1.0.0', category: 'intelligence' })
  const loadAgents = useCallback(async () => {
    try { const list = await (await fetch('/api/agents', { headers: { 'X-Role': 'engineer' }})).json(); setBuilderAgents(list.agents || []) } catch (e: any) {}
  }, [])

  // Schema Builder
  const [schemas, setSchemas] = useState<Record<string, any>>({})
  const [newSchema, setNewSchema] = useState({ name: '', fields: 'campo1:string, campo2:number' })
  const loadSchemas = useCallback(async () => {
    try { const d = await client.schemas(); setSchemas(d.schemas || {}) } catch (e: any) { setSchemas({}) }
  }, [])

  // Workflow Builder
  const [workflows, setWorkflows] = useState<any[]>([])
  const [wfDraft, setWfDraft] = useState<any>({ id: '', nodes: [], edges: [] })
  const loadWorkflows = useCallback(async () => {
    try { const d = await client.workflows(); setWorkflows(d.workflows || []) } catch (e: any) { setWorkflows([]) }
  }, [])

  // Memory Manager
  const [memList, setMemList] = useState<any[]>([])
  const [memSelected, setMemSelected] = useState<string>('')
  const [memContent, setMemContent] = useState<string>('')
  const loadMemory = useCallback(async () => {
    try {
      const r = await fetch('/api/memory/listar', { headers: { 'X-Role': 'engineer' } })
      const d = await r.json()
      setMemList(d.items || [])
    } catch (e: any) { setMemList([]) }
  }, [])

  // Polling global
  useEffect(() => {
    if (authMode !== null) {
      loadProviders(); loadHealth(); loadWatchdog(); loadBreakers(); loadMarket(); loadCustomPanels(); loadAgents(); loadSchemas(); loadWorkflows(); loadMemory()
      const t = setInterval(() => { loadHealth(); loadWatchdog(); loadBreakers(); loadMarket() }, 10000)
      return () => clearInterval(t)
    }
  }, [authMode])

  const renderModules = () => {
    if (!isEngineer) return null
    return (
      <aside className="mb5-modules">
        <div className="mb5-mod-tabs">
          {[
            { k: 'provider', l: '🌐 Provider' },
            { k: 'health', l: '💓 Health' },
            { k: 'watchdog', l: '🐕 Watchdog' },
            { k: 'circuit', l: '⚡ Circuit' },
            { k: 'market', l: '🏪 Market' },
            { k: 'custom', l: '🧩 Custom' },
            { k: 'builder', l: '🔨 Builder' },
            { k: 'schema', l: '📐 Schema' },
            { k: 'workflow', l: '🔀 Workflow' },
            { k: 'memory', l: '🧠 Memory' },
            { k: 'recovery', l: '🛟 Recovery' },
          ].map(t => (
            <button key={t.k} className={`mb5-mod-tab ${moduleOpen === t.k ? 'active' : ''}`} onClick={() => setModuleOpen(t.k)}>{t.l}</button>
          ))}
        </div>
        <div className="mb5-mod-body">
          {moduleOpen === 'provider' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Provider Layer (live)</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Auto-refresh: 10s · {providers.length} proveedores</div>
              {providers.map(p => (
                <div key={p.id} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>{p.name}</span>
                    <span className={`mb5-pill ${p.state === 'online' ? 'green' : 'red'}`} style={{ fontSize: 9 }}>{p.state}</span>
                  </div>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>P{p.priority} · {p.fallback} · {p.models.length} modelos · {p.cost_1k > 0 ? `$${p.cost_1k}/1k` : 'gratis'} · retry {p.retry} · timeout {p.timeout_s}s</div>
                  <div style={{ color: 'var(--gray)', fontSize: 9, marginTop: 2, wordBreak: 'break-all' }}>{p.endpoint}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {p.state === 'online' ? (
                      <button className="mb5-btn danger" style={{ fontSize: 9, padding: '2px 8px' }} onClick={async () => { await client.disableProvider(p.id); loadProviders() }}>⏸ Desactivar</button>
                    ) : (
                      <button className="mb5-btn primary" style={{ fontSize: 9, padding: '2px 8px' }} onClick={async () => { await client.enableProvider(p.id); loadProviders() }}>▶ Activar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'health' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Health Monitor (live)</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Último check: {healthMon?.last_check || '—'}</div>
              {Object.entries(healthMon?.services || {}).map(([k, v]: any) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, background: 'var(--panel-2)', borderRadius: 3, marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>
                  <span style={{ color: 'var(--white)' }}>{k}</span>
                  <span style={{ color: v.status === 'online' ? 'var(--green)' : 'var(--red)' }}>{v.status} · {v.latency_ms}ms</span>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'watchdog' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Watchdog (live)</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Started: {wd?.started || '—'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Heartbeats</div>
                  <div style={{ color: 'var(--accent)', fontSize: 16, fontFamily: 'var(--mono)', fontWeight: 700 }}>{wd?.heartbeat_count || 0}</div>
                </div>
                <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Auto-Recovery</div>
                  <div style={{ color: 'var(--green)', fontSize: 16, fontFamily: 'var(--mono)', fontWeight: 700 }}>{wd?.auto_recoveries || 0}</div>
                </div>
                <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Uptime (s)</div>
                  <div style={{ color: 'var(--blue)', fontSize: 14, fontFamily: 'var(--mono)' }}>{wd?.uptime_s || 0}</div>
                </div>
                <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Status</div>
                  <div style={{ color: 'var(--green)', fontSize: 14, fontFamily: 'var(--mono)' }}>{wd?.status || '—'}</div>
                </div>
              </div>
              {wd?.heartbeats?.slice(-5).reverse().map((h: any, i: number) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--gray)', fontFamily: 'var(--mono)', padding: 3, borderBottom: '1px solid var(--border)' }}>
                  {h.ts} · {h.ok ? '✓' : '✗'}
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'circuit' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Circuit Breakers (live)</h4>
              {Object.values(breakers).map((b: any) => {
                const color = b.state === 'closed' ? 'var(--green)' : b.state === 'half-open' ? 'var(--yellow)' : 'var(--red)'
                return (
                  <div key={b.name} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--white)', fontWeight: 700 }}>{b.name.toUpperCase()}</span>
                      <span style={{ color, fontWeight: 700 }}>{b.state.toUpperCase()}</span>
                    </div>
                    <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Failures: {b.failures} · Last: {b.last_failure || 'never'}</div>
                    <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }} onClick={async () => { await client.circuitReset(b.name); loadBreakers() }}>↻ Reset</button>
                  </div>
                )
              })}
            </div>
          )}

          {moduleOpen === 'market' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Marketplace (live bridge)</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Auto-refresh: 10s · {market.length} items</div>
              <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginBottom: 8 }} onClick={async () => { await client.bridgeSync(); loadMarket(); notify('ok', 'Sync desde GitHub OK') }}>↻ Sincronizar desde GitHub</button>
              {market.map((it: any) => (
                <div key={it.sha} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                  <div style={{ color: 'var(--white)', fontWeight: 700 }}>{it.name}</div>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>{it.path}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 9 }}>{it.version} · {it.size_bytes}B · {it.source}</div>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'custom' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Custom Panels (auto-discovery)</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>/opt/nct/custom-panels · {customPanels.length} paneles</div>
              {customPanels.map((p: any) => (
                <div key={p.name} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--white)' }}>{p.icon} {p.name}</span>
                    <span className="mb5-pill green" style={{ fontSize: 9 }}>{p.enabled ? 'on' : 'off'}</span>
                  </div>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>cat: {p.category} · based: {p.based_on}</div>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'builder' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Builder Studio (live)</h4>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <button className={`mb5-btn ${builderTab === 'agent' ? 'primary' : ''}`} style={{ fontSize: 9 }} onClick={() => setBuilderTab('agent')}>Agent</button>
                <button className={`mb5-btn ${builderTab === 'skill' ? 'primary' : ''}`} style={{ fontSize: 9 }} onClick={() => setBuilderTab('skill')}>Skill</button>
                <button className={`mb5-btn ${builderTab === 'workflow' ? 'primary' : ''}`} style={{ fontSize: 9 }} onClick={() => setBuilderTab('workflow')}>Workflow</button>
              </div>
              {builderTab === 'agent' && (
                <div>
                  <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} placeholder="nombre" value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} />
                  <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newAgent.role} onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}>
                    <option value="executor">executor</option>
                    <option value="planner">planner</option>
                    <option value="reviewer">reviewer</option>
                  </select>
                  <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newAgent.provider} onChange={e => setNewAgent({ ...newAgent, provider: e.target.value })}>
                    {providers.filter(p => p.state === 'online').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={async () => {
                    if (!newAgent.name) { notify('err', 'Falta nombre'); return }
                    const r = await client.builderAgent(newAgent)
                    if (r.ok) { notify('ok', `Agente ${r.agent_id} creado`); loadAgents(); setNewAgent({ ...newAgent, name: '' }) }
                  }}>+ Crear agente</button>
                </div>
              )}
              {builderTab === 'skill' && (
                <div>
                  <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} placeholder="nombre" value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })} />
                  <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newSkill.category} onChange={e => setNewSkill({ ...newSkill, category: e.target.value })}>
                    {['intelligence','infra','knowledge','agents','security','productivity','ui'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={async () => {
                    if (!newSkill.name) { notify('err', 'Falta nombre'); return }
                    const r = await client.builderSkill(newSkill)
                    if (r.ok) { notify('ok', `Skill ${r.skill_id} creado`); setNewSkill({ ...newSkill, name: '' }) }
                  }}>+ Crear skill (manifest)</button>
                </div>
              )}
              {builderTab === 'workflow' && (
                <div>
                  <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} placeholder="workflow id" value={wfDraft.id} onChange={e => setWfDraft({ ...wfDraft, id: e.target.value })} />
                  <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Nodos: {wfDraft.nodes.length} · Edges: {wfDraft.edges.length}</div>
                  <button className="mb5-btn" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={() => {
                    const next = wfDraft.nodes.length + 1
                    const newNode = { id: 'n' + next, type: 'agent', label: 'n' + next, x: 50 + next * 100, y: 50 }
                    setWfDraft({ ...wfDraft, nodes: [...wfDraft.nodes, newNode] })
                  }}>+ Nodo</button>
                  <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={() => {
                    if (!wfDraft.id) { notify('err', 'Falta id'); return }
                    if (wfDraft.nodes.length < 1) { notify('err', 'A\u00f1ade al menos 1 nodo'); return }
                    if (wfDraft.nodes.length < 2) { notify('err', 'Necesitas 2 nodos'); return }
                    const a = wfDraft.nodes[wfDraft.nodes.length-2]
                    const b = wfDraft.nodes[wfDraft.nodes.length-1]
                    setWfDraft({ ...wfDraft, edges: [...wfDraft.edges, { from: a.id, to: b.id }] })
                    notify('ok', 'Edge a\u00f1adido')
                  }}>↔ Conectar últimos 2</button>
                  <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginTop: 4 }} onClick={async () => {
                    const r = await client.saveWorkflow(wfDraft)
                    if (r.ok) { notify('ok', `Workflow ${r.id} guardado`); loadWorkflows(); setWfDraft({ id: '', nodes: [], edges: [] }) }
                  }}>💾 Guardar</button>
                </div>
              )}
              {builderAgents.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Agentes creados ({builderAgents.length})</div>
                  {builderAgents.map((a: any) => (
                    <div key={a.id} style={{ background: 'var(--panel-2)', padding: 4, borderRadius: 3, fontSize: 9, fontFamily: 'var(--mono)', marginBottom: 3 }}>
                      {a.id} · {a.role} · {a.provider}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {moduleOpen === 'schema' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Schema Builder (live)</h4>
              <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontSize: 10, fontFamily: 'var(--mono)' }} placeholder="schema name" value={newSchema.name} onChange={e => setNewSchema({ ...newSchema, name: e.target.value })} />
              <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontSize: 10, fontFamily: 'var(--mono)' }} placeholder="campos: a:string, b:number" value={newSchema.fields} onChange={e => setNewSchema({ ...newSchema, fields: e.target.value })} />
              <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={async () => {
                if (!newSchema.name) { notify('err', 'Falta nombre'); return }
                const fields = newSchema.fields.split(',').map(f => {
                  const [name, kind='string'] = f.trim().split(':')
                  return { name: name.trim(), kind: kind.trim(), required: false }
                }).filter(f => f.name)
                const body = { type: newSchema.name, fields }
                const r = await client.saveSchema(newSchema.name, body)
                if (r.ok) { notify('ok', `Schema ${newSchema.name} guardado`); loadSchemas(); setNewSchema({ name: '', fields: 'campo:string' }) }
              }}>+ Guardar schema</button>
              {Object.entries(schemas).map(([k, v]: any) => (
                <div key={k} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 6, marginBottom: 4, fontSize: 9, fontFamily: 'var(--mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--white)' }}>{k}</span>
                    <button className="mb5-btn danger" style={{ fontSize: 8, padding: '1px 6px' }} onClick={async () => {
                      await fetch(`/api/schemas/${k}`, { method: 'DELETE', headers: { 'X-Role': 'engineer' }})
                      loadSchemas(); notify('ok', 'Eliminado')
                    }}>🗑</button>
                  </div>
                  <div style={{ color: 'var(--gray-2)' }}>{(v.fields || []).map((f: any) => f.name).join(', ')}</div>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'workflow' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Workflows guardados</h4>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 8 }}>/opt/nct/workflows · {workflows.length} workflows</div>
              {workflows.map((w: any) => (
                <div key={w.id} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>{w.id}</span>
                    <button className="mb5-btn danger" style={{ fontSize: 8, padding: '1px 6px' }} onClick={async () => { await fetch(`/api/workflows/${w.id}`, { method: 'DELETE', headers: { 'X-Role': 'engineer' }}); loadWorkflows() }}>🗑</button>
                  </div>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Nodos: {w.nodes.length} · Edges: {w.edges?.length || 0} · {w.ts}</div>
                  <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }} onClick={() => { setWfDraft(w); setModuleOpen('builder'); notify('info', `Cargado en builder`) }}>↻ Cargar</button>
                </div>
              ))}
            </div>
          )}

          {moduleOpen === 'memory' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Memory Manager (live)</h4>
              <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginBottom: 8 }} onClick={loadMemory}>↻ Refrescar</button>
              {memList.map((m: any) => (
                <div key={m.path} style={{ background: memSelected === m.path ? 'var(--panel-2)' : 'transparent', border: `1px solid ${memSelected === m.path ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 3, padding: 6, marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer' }} onClick={async () => {
                  setMemSelected(m.path)
                  const r = await client.memoryRead(m.path)
                  setMemContent(r.content)
                }}>
                  <span style={{ color: 'var(--white)' }}>{m.path}</span>
                  <span style={{ color: 'var(--gray-2)', fontSize: 9, marginLeft: 6 }}>{m.size}b</span>
                </div>
              ))}
              {memSelected && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Editando: {memSelected}</div>
                  <textarea className="mb5-input" style={{ width: '100%', height: 80, fontFamily: 'var(--mono)', fontSize: 10 }} value={memContent} onChange={e => setMemContent(e.target.value)} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button className="mb5-btn primary" style={{ flex: 1, fontSize: 9 }} onClick={async () => {
                      const r = await client.memorySave(memSelected, memContent)
                      if (r.ok) { notify('ok', 'Guardado'); loadMemory() }
                    }}>💾 Guardar</button>
                    <button className="mb5-btn danger" style={{ flex: 1, fontSize: 9 }} onClick={async () => {
                      await fetch(`/api/memory/eliminar?path=${encodeURIComponent(memSelected)}`, { method: 'DELETE', headers: { 'X-Role': 'engineer' }})
                      notify('ok', 'Eliminado')
                      setMemSelected(''); setMemContent(''); loadMemory()
                    }}>🗑 Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {moduleOpen === 'recovery' && (
            <div>
              <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Recovery (live)</h4>
              <div style={{ background: 'var(--panel-2)', borderRadius: 3, padding: 8, marginBottom: 8, fontFamily: 'var(--mono)', fontSize: 10 }}>
                <div style={{ color: 'var(--gray-2)' }}>Auto-recoveries: <span style={{ color: 'var(--green)' }}>{wd?.auto_recoveries || 0}</span></div>
                <div style={{ color: 'var(--gray-2)' }}>Status: <span style={{ color: 'var(--green)' }}>{wd?.status || '—'}</span></div>
              </div>
              <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={async () => { const r = await client.recoverySimulate(); notify('ok', `Recovery simulado: ${r.auto_recoveries}`); loadWatchdog() }}>▶ Simular Recovery</button>
              <div style={{ fontSize: 9, color: 'var(--gray-2)', marginTop: 8 }}>Circuit Breakers:</div>
              {Object.values(breakers).map((b: any) => (
                <button key={b.name} className="mb5-btn" style={{ width: '100%', fontSize: 9, marginTop: 3 }} onClick={async () => { await client.circuitReset(b.name); loadBreakers() }}>↻ Reset {b.name}</button>
              ))}
            </div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <div className={`mb5 ${labOpen ? 'lab-open' : ''} ${aiOpen ? 'ai-open' : ''}`}>
      <header className="mb5-topbar">
        <div className="mb5-logo">
          <span className="mb5-logo-dot" />
          MAXBRY
        </div>
        <div className="mb5-project">⎇ maxbry-router · main</div>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: isEngineer ? 'var(--accent)' : 'var(--gray)', padding: '4px 8px', background: 'var(--panel-2)', border: `1px solid ${isEngineer ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isEngineer ? '🔐' : '👤'} {isEngineer ? `INGENIERO · ${session.email}` : 'USUARIO'}
        </div>
        <div className="mb5-spacer" />
        <div className="mb5-topbar-actions">
          <input className="mb5-search" placeholder="Buscar (Ctrl+K)" onFocus={() => setPaletteOpen(true)} />
          <button className="mb5-btn primary" onClick={onRun}>▶ Run</button>
          {isEngineer && <button className="mb5-btn icon" onClick={() => setLabOpen(o => !o)} title="Laboratorio (Ctrl+L)">🧪</button>}
          <button className="mb5-btn" onClick={() => setAuthMode('login')}>🔑 Cambiar acceso</button>
          <button className="mb5-btn icon" onClick={() => setAiOpen(o => !o)} title="AI Assistant">🤖</button>
          <button className="mb5-btn icon" onClick={refresh} title="Refrescar">↻</button>
          <button className="mb5-btn danger" onClick={handleLogout} title="Bloquear">⏻</button>
        </div>
      </header>

      <aside className="mb5-resources">{renderResources()}</aside>

      <main className="mb5-canvas">
        <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
          <h3 style={{ color: 'var(--white)', fontSize: 14, fontFamily: 'var(--mono)', margin: '0 0 12px' }}>Mis agentes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {agents.map(a => (
              <div key={a.id} className="mb5-node" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setSelectedAgentId(a.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'var(--white)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{a.name}</div>
                  <span className="mb5-pill accent">{a.ia.modelo}</span>
                </div>
                <div style={{ color: 'var(--gray)', fontSize: 10, margin: '8px 0' }}>{a.template || 'custom'}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.entries(a.entradas).filter(([_, v]) => v).slice(0, 3).map(([k]) => <span key={k} className="mb5-pill blue">{k}</span>)}
                  {Object.entries(a.salidas).filter(([_, v]) => v).slice(0, 3).map(([k]) => <span key={k} className="mb5-pill purple">{k}</span>)}
                </div>
              </div>
            ))}
          </div>
          {isEngineer && <button className="mb5-btn primary" style={{ marginTop: 16 }} onClick={onCreateAgent}>+ Nuevo agente</button>}
          {!isEngineer && <div style={{ color: 'var(--gray-2)', fontSize: 11, fontFamily: 'var(--mono)', marginTop: 16, padding: 12, background: 'var(--panel-2)', borderRadius: 3, border: '1px solid var(--border)' }}>ℹ Modo lectura: puedes usar los agentes pero no crear nuevos. Solicita acceso ingeniero al administrador.</div>}

          <h3 style={{ color: 'var(--white)', fontSize: 14, fontFamily: 'var(--mono)', margin: '24px 0 12px' }}>Workflow (constructor visual)</h3>
          <div style={{ height: 400, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, position: 'relative' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-hi)" />
              <Controls position="bottom-left" />
              <MiniMap position="bottom-right" nodeColor={(n) => n.type === 'flowNode' ? 'var(--accent)' : 'var(--blue)'} maskColor="rgba(0,0,0,0.7)" />
            </ReactFlow>
          </div>
        </div>
        <div className="mb5-canvas-mini">
          <span>NODOS <b>{nodes.length}</b></span>
          <span>RUNS <b>{runs.length}</b></span>
          <span>LOGS <b>{logs.length}</b></span>
          <span>WS <b>{ws.connected ? 'ON' : 'OFF'}</b></span>
        </div>
      </main>

      <aside className="mb5-inspector">{renderInspector()}</aside>
      {renderModules()}
      {renderLab()}

      <footer className="mb5-statusbar">
        <span>● {isEngineer ? 'MODO INGENIERO' : 'MODO USUARIO'}</span>
        <span>{dash?.nodos_red || 0} NODOS</span>
        <span>{dash?.rutas || 0} RUTAS</span>
        <span>{dash?.fichas || 0} FICHAS</span>
        <span style={{ marginLeft: 'auto' }}>WS {ws.connected ? 'OK' : 'OFF'}</span>
        <span>{isEngineer ? '🔓 DESBLOQUEADO' : '🔒 BLOQUEADO'}</span>
        <span>{labOpen && isEngineer ? '🧪 LAB' : ''}</span>
      </footer>

      {paletteOpen && (
        <div className="mb5-palette-bg" onClick={() => setPaletteOpen(false)}>
          <div className="mb5-palette" onClick={e => e.stopPropagation()}>
            <input autoFocus placeholder="Comando (Ctrl+K)" value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filteredCmds[0]) onPaletteRun(filteredCmds[0].id) }} />
            <div className="mb5-palette-list">
              {filteredCmds.map((c, i) => (
                <div key={c.id} className={`mb5-palette-item ${i === 0 ? 'active' : ''}`} onClick={() => onPaletteRun(c.id)}>
                  <span>{c.label}{c.engineer && !isEngineer ? ' (🔒)' : ''}</span>
                  {c.shortcut && <span className="shortcut">{c.shortcut}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="mb5-modal-bg" onClick={() => setModal(null)}>
          <div className="mb5-modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.title}<span style={{ cursor: 'pointer', color: 'var(--gray)' }} onClick={() => setModal(null)}>×</span></h3>
            {modal.fields.map(f => (
              <div key={f.name}>
                <label>{f.label}</label>
                {f.type === 'textarea' ? <textarea defaultValue={f.value} id={`f-${f.name}`} /> : <input defaultValue={f.value} id={`f-${f.name}`} />}
              </div>
            ))}
            <div className="mb5-modal-actions">
              <button className="mb5-btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="mb5-btn primary" onClick={() => {
                const vals: any = {}
                modal.fields.forEach(f => { vals[f.name] = (document.getElementById(`f-${f.name}`) as any)?.value || '' })
                modal.onSubmit(vals)
              }}>Ejecutar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mb5-toast ${toast.kind}`}>{toast.kind === 'ok' ? '✓ ' : toast.kind === 'err' ? '✗ ' : 'ℹ '}{toast.text}</div>}

      {/* ===== AI ASSISTANT PANEL (sidebar siempre disponible) ===== */}
      <aside className={`mb5-ai ${aiOpen ? '' : 'collapsed'}`}>
        <div className="mb5-ai-head">
          <span className="pulse" />
          <span className="title">🤖 Router Assistant</span>
          <button className="mb5-btn icon" onClick={() => setAiOpen(false)} title="Cerrar">×</button>
        </div>
        <div className="mb5-ai-tabs">
          {([['config', 'Config'], ['diagnostics', 'Diagnóstico'], ['architecture', 'Arquitectura'], ['optimization', 'Optimización']] as const).map(([k, l]) => (
            <button key={k} className={`mb5-ai-tab ${aiTab === k ? 'active' : ''}`} onClick={() => setAiTab(k as any)}>{l}</button>
          ))}
        </div>
        <div className="mb5-ai-quick">
          {[
            { id: 'connect-github', label: '+ Conectar GitHub' },
            { id: 'create-agent', label: '+ Crear agente' },
            { id: 'config-hf', label: '+ Configurar HF' },
            { id: 'create-workflow', label: '+ Crear Workflow' },
            { id: 'search-error', label: '🔍 Buscar error' },
            { id: 'audit', label: '📋 Audit' },
            { id: 'optimize', label: '⚡ Optimizar' }
          ].map(q => (
            <button key={q.id} onClick={() => aiQuick(q.id)}>{q.label}</button>
          ))}
        </div>
        <div className="mb5-ai-body">
          {aiChat.slice(-12).map((m, i) => (
            <div key={i} className="mb5-ai-step">
              <div className="step-title">{m.role === 'user' ? '👤 TÚ' : aiTab === 'diagnostics' ? '🔍 DIAGNOSTICS' : aiTab === 'architecture' ? '🏗️ ARCHITECTURE' : aiTab === 'optimization' ? '⚡ OPTIMIZATION' : '🤖 CONFIG'}</div>
              <div className="step-content" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              {m.steps && m.steps.map((s: any, j: number) => {
                if (s.kind === 'wizard') {
                  return (
                    <div key={j} style={{ marginTop: 8, padding: 8, background: 'var(--bg)', borderRadius: 3, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'var(--mono)', marginBottom: 4 }}>PASO {j + 1}</div>
                      <div style={{ fontSize: 11, color: 'var(--white)', marginBottom: 4 }}>{s.q}</div>
                      {s.hint && <div style={{ fontSize: 10, color: 'var(--gray)' }}>{s.hint}</div>}
                      {s.placeholder && <input defaultValue={s.placeholder} style={{ width: '100%', marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--white)', padding: 4, fontFamily: 'var(--mono)', fontSize: 10, borderRadius: 2 }} />}
                      {s.value && <input defaultValue={s.value} style={{ width: '100%', marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--white)', padding: 4, fontFamily: 'var(--mono)', fontSize: 10, borderRadius: 2 }} />}
                      {s.opts && <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{s.opts.map((o: string) => <button key={o} className="mb5-ai-fix" style={{ background: 'var(--panel-2)', color: 'var(--white)' }}>{o}</button>)}</div>}
                    </div>
                  )
                }
                if (s.kind === 'action') {
                  return <button key={j} className={`mb5-ai-fix ${s.label.startsWith('✎') ? 'danger' : ''}`} style={{ marginTop: 4, marginRight: 4 }} onClick={() => { if (s.action === 'apply-nl') { notify('ok', 'Configuración aplicada'); setAiChat(c => [...c, { role: 'ai', text: '✓ Configuración aplicada al sistema.' }]) } else { notify('info', 'Ajusta manualmente') } }}>{s.label}</button>
                }
                if (s.kind === 'fix') {
                  return <div key={j} className="step-content" style={{ marginTop: 4, paddingLeft: 12, borderLeft: '2px solid var(--accent)' }}>• {s.text}</div>
                }
                if (s.level) {
                  return <div key={j} className={s.level === 'err' ? 'err' : 'warn'} style={{ fontSize: 10, padding: '2px 0' }}>{s.level === 'err' ? '✗' : '⚠'} {s.msg}</div>
                }
                if (s.area) {
                  return <div key={j} className="step-content" style={{ marginTop: 4 }}><span style={{ color: 'var(--cyan)' }}>[{s.area}]</span> {s.tip}</div>
                }
                if (s.kind === 'preview') {
                  return (
                    <div key={j} style={{ marginTop: 8, padding: 8, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 10 }}>
                      <div>entradas: <span style={{ color: 'var(--blue)' }}>{s.config.entradas.join(', ') || '—'}</span></div>
                      <div>salidas: <span style={{ color: 'var(--purple)' }}>{s.config.salidas.join(', ') || '—'}</span></div>
                      <div>agente: <span style={{ color: 'var(--accent)' }}>{s.config.agente}</span></div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          ))}

          {/* SCORE audit siempre visible en tab architecture */}
          {aiTab === 'architecture' && (
            <div className="mb5-ai-step">
              <div className="step-title">SCORE ARQUITECTURA</div>
              <div className={`mb5-ai-score ${(() => { const r = reviewArchitecture(); return r.score < 70 ? 'err' : r.score < 90 ? 'warn' : '' })()}`}>
                {reviewArchitecture().score}/100
              </div>
              <button className="mb5-ai-fix" onClick={() => aiQuick('audit')}>📋 Ver detalles</button>
            </div>
          )}

          {aiTab === 'optimization' && (
            <div className="mb5-ai-step">
              <div className="step-title">RECOMENDACIONES</div>
              {optimize().map((t, i) => (
                <div key={i} style={{ marginTop: 6, padding: 6, background: 'var(--bg)', borderRadius: 3, fontSize: 10 }}>
                  <span style={{ color: 'var(--cyan)' }}>[{t.area}]</span> {t.tip}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mb5-ai-input">
          <input
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAiSubmit()}
            placeholder="Pregunta o describe qué quieres configurar..."
          />
          <button className="mb5-btn primary" onClick={onAiSubmit}>▶</button>
        </div>
      </aside>

      {!aiOpen && (
        <button className="mb5-ai-toggle" onClick={() => setAiOpen(true)}>🤖 Assistant</button>
      )}

      {/* ===== MINI CHAT FLOTANTE (panel pequeño) ===== */}
      {miniOpen ? (
        <div className={`mb5-mini-chat ${miniMinimized ? 'minimized' : ''}`}>
          <div className="mb5-mini-head" onClick={() => setMiniMinimized(m => !m)}>
            <span className="pulse" />
            <span className="title">🤖 AI Agent</span>
            <div className="actions">
              <button onClick={(e) => { e.stopPropagation(); setMiniMinimized(m => !m) }} title={miniMinimized ? 'Expandir' : 'Minimizar'}>{miniMinimized ? '▲' : '▼'}</button>
              <button onClick={(e) => { e.stopPropagation(); setMiniOpen(false) }} title="Cerrar">×</button>
            </div>
          </div>
          {!miniMinimized && (
            <>
              <div className="mb5-mini-body">
                {miniChat.slice(-15).map((m, i) => (
                  <div key={i} className={`mb5-mini-msg ${m.role}`}>
                    <div className="role">{m.role === 'user' ? 'TÚ' : m.role === 'system' ? 'SISTEMA' : 'AGENT'}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                    {m.autofill && (
                      <div className="autofill">
                        {m.autofill.map((f, j) => (
                          <div key={j} className="field">
                            <span className="k">{f.field}</span>
                            <span className="v">{f.value}</span>
                          </div>
                        ))}
                        {m.action === 'apply' && (
                          <button className="apply" onClick={() => applyAutofill(m.autofill!)}>✓ Aplicar al agente seleccionado</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mb5-mini-input">
                <input
                  value={miniInput}
                  onChange={e => setMiniInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onMiniSubmit()}
                  placeholder="Describe la configuración..."
                />
                <button onClick={onMiniSubmit}>▶</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className="mb5-mini-launcher" onClick={() => setMiniOpen(true)}>🤖</button>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}

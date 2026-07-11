// MAXBRY Centro de Control Universal
// Diseño: iOS dark, JetBrains Mono + Inter, acentos en verde/cyan/azul
// Tipografía con peso deliberado, escala tipográfica intencional
import { useState, useEffect, useMemo } from 'react'
import { api, RouterWS } from './api'

const ws = new RouterWS()
ws.connect()

const C = {
  bg: '#000', panel: '#0a0e1a', panel2: '#131826', border: '#1f2433',
  white: '#fff', gray: '#9aa0a6', gray2: '#5f6368',
  green: '#10a37f', green2: '#34a853', cyan: '#06b6d4', blue: '#4285f4',
  red: '#ea4335', yellow: '#fbbc04', purple: '#a142f4'
}

const font = { display: '"JetBrains Mono", "SF Mono", monospace', body: '"Inter", -apple-system, sans-serif' }

function Pill({ children, color = 'gray' }: any) {
  const map: any = { gray: C.gray, green: C.green, blue: C.blue, red: C.red, yellow: C.yellow, purple: C.purple, cyan: C.cyan }
  return <span style={{ display: 'inline-block', background: 'transparent', color: map[color], border: `1px solid ${map[color]}40`, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: font.display, letterSpacing: 0.5, textTransform: 'uppercase' }}>{children}</span>
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' ? C.green : status === 'warning' ? C.yellow : status === 'error' ? C.red : C.gray2
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
}

function Section({ eyebrow, title, children }: any) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ color: C.cyan, fontFamily: font.display, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>{eyebrow}</span>
        <h2 style={{ color: C.white, fontFamily: font.display, fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, sub }: any) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: C.green }} />
      <div style={{ color: C.gray, fontFamily: font.display, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: C.white, fontFamily: font.display, fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: C.gray2, fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Module({ name, endpoint, badge, onHit }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)
  const test = async () => {
    setLoading(true); setErr(false)
    try {
      const d = await api(endpoint)
      setData(d)
      onHit?.(name, true)
    } catch { setErr(true); onHit?.(name, false) }
    setLoading(false)
  }
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, transition: 'all 0.15s' }}
         onMouseEnter={e => (e.currentTarget.style.borderColor = C.green)}
         onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: C.white, fontFamily: font.display, fontSize: 12, fontWeight: 600 }}>{name}</span>
        {badge}
      </div>
      <div style={{ color: C.gray2, fontFamily: font.display, fontSize: 10, marginBottom: 8 }}>{endpoint}</div>
      <button onClick={test} disabled={loading} style={{ background: err ? C.red : C.green, color: '#000', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 10, fontFamily: font.display, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
        {loading ? '⟳ TESTING' : err ? '✕ ERROR' : '▶ TEST'}
      </button>
      {data && <pre style={{ color: C.gray, fontSize: 10, marginTop: 8, maxHeight: 80, overflow: 'auto', background: C.bg, padding: 6, borderRadius: 4, fontFamily: font.display }}>{JSON.stringify(data).slice(0, 250)}</pre>}
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<'novato' | 'experto'>('novato')
  const [status, setStatus] = useState<any>(null)
  const [, setArch] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [hits, setHits] = useState<{ok: number, fail: number}>({ok: 0, fail: 0})
  const [search, setSearch] = useState('')
  const [path] = useState(['Inicio', 'Router', mode === 'novato' ? 'Vista' : 'Experto'])

  useEffect(() => {
    api('/api/status/global').then(setStatus).catch(() => {})
    api('/api/architecture').then(setArch).catch(() => {})
    ws.on(m => setLogs(l => [...l.slice(-30), m]))
  }, [])

  const modulos = useMemo(() => [
    { name: 'M43 Service Registry', ep: '/api/registry/services', badge: <Pill color="green">core</Pill> },
    { name: 'M44 Queue Manager', ep: '/api/queue', badge: <Pill color="blue">flow</Pill> },
    { name: 'M45 Sandbox Manager', ep: '/api/sandboxes', badge: <Pill color="purple">iso</Pill> },
    { name: 'M46 Secrets Vault', ep: '/api/vault', badge: <Pill color="red">enc</Pill> },
    { name: 'M47 Cost Manager', ep: '/api/cost', badge: <Pill color="yellow">$</Pill> },
    { name: 'M48 Scheduler', ep: '/api/scheduler', badge: <Pill color="cyan">cron</Pill> },
    { name: 'M49 Event Bus', ep: '/api/events', badge: <Pill color="green">bus</Pill> },
    { name: 'M50 Feature Flags', ep: '/api/flags', badge: <Pill color="blue">tog</Pill> },
    { name: 'M57 Agent Registry', ep: '/api/agents/registry', badge: <Pill color="green">core</Pill> },
    { name: 'M52 Sessions', ep: '/api/sessions', badge: <Pill color="purple">save</Pill> },
    { name: 'M53 Policies', ep: '/api/policies', badge: <Pill color="yellow">law</Pill> },
    { name: 'M54 Backups', ep: '/api/backup', badge: <Pill color="cyan">zip</Pill> },
    { name: 'M55 Live Graph', ep: '/api/graph/live', badge: <Pill color="green">viz</Pill> },
    { name: 'M56 DSL Editor', ep: '/api/dsl/editor', badge: <Pill color="blue">flow</Pill> },
    { name: 'M58 Providers', ep: '/api/providers', badge: <Pill color="red">18</Pill> },
    { name: 'M59 Model Registry', ep: '/api/models/registry', badge: <Pill color="purple">10</Pill> },
    { name: 'M60 Catalog', ep: '/api/catalog', badge: <Pill color="cyan">9</Pill> },
    { name: 'M61 Architecture', ep: '/api/architecture', badge: <Pill color="green">3capas</Pill> },
    { name: 'M62 Agent Identity', ep: '/api/agent/identity', badge: <Pill color="blue">3</Pill> },
    { name: 'Mapa Red Universal', ep: '/api/red/mapa', badge: <Pill color="green">core</Pill> },
  ], [])

  const filtered = modulos.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ background: C.bg, color: C.white, minHeight: '100vh', padding: '24px 32px 120px', fontFamily: font.body }}>
      <header style={{ marginBottom: 32, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: C.cyan, fontFamily: font.display, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
              ⬢ Centro de Control Universal
            </div>
            <h1 style={{ color: C.white, fontFamily: font.display, fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: -1 }}>
              MAXBRY<span style={{ color: C.green }}>.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('novato')} style={{ background: mode === 'novato' ? C.green : 'transparent', color: mode === 'novato' ? '#000' : C.gray, border: `1px solid ${mode === 'novato' ? C.green : C.border}`, padding: '6px 14px', borderRadius: 4, fontSize: 11, fontFamily: font.display, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>Novato</button>
            <button onClick={() => setMode('experto')} style={{ background: mode === 'experto' ? C.green : 'transparent', color: mode === 'experto' ? '#000' : C.gray, border: `1px solid ${mode === 'experto' ? C.green : C.border}`, padding: '6px 14px', borderRadius: 4, fontSize: 11, fontFamily: font.display, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>Experto</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.gray2, fontSize: 11, fontFamily: font.display }}>
          {path.map((p, i) => (
            <span key={i}>
              <span style={{ color: i === path.length - 1 ? C.white : C.gray2 }}>{p}</span>
              {i < path.length - 1 && <span style={{ margin: '0 8px', color: C.gray2 }}>/</span>}
            </span>
          ))}
        </div>
      </header>

      {/* Status Global + Stats */}
      <Section eyebrow="01 · Estado" title="Mapa global del sistema">
        {status && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(status).map(([k, v]: any) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <StatusDot status={v} />
                <span style={{ color: C.gray, fontFamily: font.display, fontSize: 11 }}>{k}</span>
                <span style={{ color: C.white, fontFamily: font.display, fontSize: 11, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Stat label="Agentes" value="3" sub="claude · mimo · openclaw" />
          <Stat label="Módulos" value="60+" sub="REST + WebSocket" />
          <Stat label="Providers" value="18" sub="AI gateways" />
          <Stat label="Tests" value={`${hits.ok}✓ ${hits.fail}✕`} sub="live verification" />
        </div>
      </Section>

      {/* Quick Actions */}
      <Section eyebrow="02 · Quick Actions" title="Comandos rápidos">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { i: '▶', l: 'Ejecutar' }, { i: '⏸', l: 'Pausar' }, { i: '⏹', l: 'Detener' },
            { i: '🔄', l: 'Reiniciar' }, { i: '💾', l: 'Guardar' }, { i: '📤', l: 'Export' },
            { i: '📥', l: 'Import' }, { i: '📋', l: 'Duplicar' }
          ].map(a => (
            <button key={a.l} style={{ background: C.panel, color: C.gray, border: `1px solid ${C.border}`, padding: '8px 12px', borderRadius: 4, fontSize: 11, fontFamily: font.display, cursor: 'pointer' }}>{a.i} {a.l}</button>
          ))}
        </div>
      </Section>

      {/* Búsqueda Universal */}
      <Section eyebrow="03 · Search" title="Búsqueda universal (Ctrl+K)">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar módulo..." style={{ width: '100%', background: C.panel, color: C.white, border: `1px solid ${C.border}`, padding: '10px 14px', borderRadius: 4, fontSize: 12, fontFamily: font.display, outline: 'none' }} />
      </Section>

      {/* Módulos */}
      <Section eyebrow="04 · Modules" title={`${mode === 'novato' ? 'Vista Novato' : 'Vista Experto'} · ${filtered.length} módulos`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {filtered.slice(0, mode === 'novato' ? 8 : 100).map(m => (
            <Module key={m.name} {...m} onHit={(_: string, ok: boolean) => setHits(h => ({ ok: h.ok + (ok ? 1 : 0), fail: h.fail + (ok ? 0 : 1) }))} />
          ))}
        </div>
      </Section>

      {/* WebSocket Logs */}
      <Section eyebrow="05 · Stream" title="WebSocket /ws/router">
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: 12, maxHeight: 200, overflow: 'auto', fontFamily: font.display, fontSize: 10, color: C.gray }}>
          {logs.length === 0 ? <span style={{ color: C.gray2 }}>// esperando mensajes en vivo...</span> :
            logs.map((l, i) => <div key={i} style={{ marginBottom: 2 }}>→ {JSON.stringify(l).slice(0, 120)}</div>)}
        </div>
      </Section>

      {/* Dock inferior fijo */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.panel, borderTop: `1px solid ${C.border}`, padding: '10px 0', display: 'flex', justifyContent: 'center', gap: 16, fontFamily: font.display, fontSize: 11 }}>
        {['⬢ Router', '≣ Logs', '▶ Terminal', '⌬ Memoria', '◉ Estado'].map(d => (
          <span key={d} style={{ color: C.gray, cursor: 'pointer', padding: '4px 12px' }}>{d}</span>
        ))}
      </div>
    </div>
  )
}

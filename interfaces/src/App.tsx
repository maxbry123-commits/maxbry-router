// MAXBRY Centro de Control Universal - App principal
import { useState, useEffect } from 'react'
import { api, RouterWS } from './api'

const ws = new RouterWS()
ws.connect()

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? '#10a37f' : status === 'warning' ? '#fbbc04' : status === 'error' ? '#ea4335' : '#5f6368'
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: color, marginRight: 6 }} />
}

function Panel({ title, children }: any) {
  return (
    <div style={{ background: '#0a0e1a', border: '1px solid #2a3147', borderRadius: 6, padding: 10, marginBottom: 10 }}>
      <h3 style={{ color: '#4285f4', fontSize: 13, marginBottom: 6 }}>{title}</h3>
      {children}
    </div>
  )
}

function ModuleCard({ name, endpoint, onTest }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const test = async () => {
    setLoading(true)
    try {
      const d = await api(endpoint)
      setData(d)
      onTest?.(name, 'OK')
    } catch (e: any) {
      setData({ error: e.message })
      onTest?.(name, 'FAIL')
    }
    setLoading(false)
  }
  return (
    <div style={{ background: '#131826', border: '1px solid #2a3147', borderRadius: 4, padding: 8, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#9aa0a6', fontSize: 12 }}>{name}</span>
        <button onClick={test} disabled={loading} style={{ background: '#4285f4', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}>
          {loading ? '...' : 'TEST'}
        </button>
      </div>
      {data && <pre style={{ color: '#5f6368', fontSize: 10, marginTop: 4, maxHeight: 100, overflow: 'auto' }}>{JSON.stringify(data, null, 2).slice(0, 300)}</pre>}
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<'novato' | 'experto'>('novato')
  const [status, setStatus] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [selected] = useState('dashboard')

  useEffect(() => {
    api('/api/status/global').then(setStatus).catch(() => {})
    ws.on((m) => setLogs(l => [...l.slice(-50), m]))
  }, [])

  const modulos = [
    { name: 'M43 Service Registry', ep: '/api/registry/services' },
    { name: 'M44 Queue Manager', ep: '/api/queue' },
    { name: 'M45 Sandbox Manager', ep: '/api/sandboxes' },
    { name: 'M46 Secrets Vault', ep: '/api/vault' },
    { name: 'M47 Cost Manager', ep: '/api/cost' },
    { name: 'M48 Scheduler', ep: '/api/scheduler' },
    { name: 'M49 Event Bus', ep: '/api/events' },
    { name: 'M50 Feature Flags', ep: '/api/flags' },
    { name: 'M52 Sessions', ep: '/api/sessions' },
    { name: 'M53 Policies', ep: '/api/policies' },
    { name: 'M54 Backups', ep: '/api/backup' },
    { name: 'M55 Live Graph', ep: '/api/graph/live' },
    { name: 'M56 DSL Editor', ep: '/api/dsl/editor' },
    { name: 'M57 Agent Registry', ep: '/api/agents/registry' },
    { name: 'M33 Quick Actions', ep: '/api/quick-actions' },
    { name: 'M34 Breadcrumb', ep: '/api/breadcrumb' },
    { name: 'M35 Recientes', ep: '/api/recent' },
    { name: 'M37 Sidebar', ep: '/api/sidebar' },
    { name: 'M38 Dock', ep: '/api/dock' },
    { name: 'M39 Wizard', ep: '/api/wizard/init' },
    { name: 'M40 Estado Global', ep: '/api/status/global' },
    { name: 'M41 Context Menu', ep: '/api/context-menu' },
    { name: 'M42 Layouts', ep: '/api/layouts' },
    { name: 'Mapa Red Universal', ep: '/api/red/mapa' },
  ]

  const modulosNovato = modulos.filter(m => ['M40 Estado Global', 'M44 Queue Manager', 'M47 Cost Manager', 'M57 Agent Registry'].includes(m.name))

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: 20, fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#4285f4' }}>MAXBRY Centro de Control</h1>
      <p style={{ color: '#5f6368', fontSize: 11 }}>Router Universal · 57 módulos · 2026-07-11</p>

      {/* Modo toggle */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setMode('novato')} style={{ background: mode === 'novato' ? '#4285f4' : '#131826', color: mode === 'novato' ? '#000' : '#fff', border: 'none', padding: '6px 12px', marginRight: 6, borderRadius: 4, cursor: 'pointer' }}>Novato</button>
        <button onClick={() => setMode('experto')} style={{ background: mode === 'experto' ? '#4285f4' : '#131826', color: mode === 'experto' ? '#000' : '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>Experto</button>
      </div>

      {/* Breadcrumb */}
      <div style={{ color: '#9aa0a6', fontSize: 11, marginBottom: 16 }}>
        Inicio &gt; Router &gt; {selected}
      </div>

      {/* Estado Global */}
      {status && (
        <Panel title="🟢 M40 · Estado Global">
          {Object.entries(status).map(([k, v]: any) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#9aa0a6', marginBottom: 3 }}>
              <StatusBadge status={v} />{k}: {v}
            </div>
          ))}
        </Panel>
      )}

      {/* Quick Actions */}
      <Panel title="▶ M33 · Quick Actions">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['▶ Ejecutar', '⏸ Pausar', '⏹ Detener', '🔄 Reiniciar', '💾 Guardar', '📤 Export', '📥 Import', '📋 Duplicar'].map(a => (
            <button key={a} style={{ background: '#131826', color: '#9aa0a6', border: '1px solid #2a3147', padding: '6px 10px', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>{a}</button>
          ))}
        </div>
      </Panel>

      {/* Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {['Router', '8 agentes', '57 módulos', '3 keys NIM'].map((t, i) => (
          <div key={i} style={{ background: '#0a0e1a', border: '1px solid #2a3147', borderRadius: 6, padding: 10, textAlign: 'center' }}>
            <div style={{ color: '#4285f4', fontSize: 22, fontWeight: 700 }}>{t.split(' ')[0]}</div>
            <div style={{ color: '#5f6368', fontSize: 10 }}>{t.split(' ').slice(1).join(' ')}</div>
          </div>
        ))}
      </div>

      {/* Command Palette */}
      <Panel title="⌨ Command Palette (Ctrl+K)">
        <input placeholder="Buscar: agentes, skills, documentos, workflows..." style={{ width: '100%', background: '#131826', color: '#fff', border: '1px solid #2a3147', padding: 8, borderRadius: 4, fontSize: 12 }} />
      </Panel>

      {/* Búsqueda Universal */}
      <Panel title="🔍 M36 · Búsqueda Universal">
        <input placeholder="Buscar en todo el sistema..." style={{ width: '100%', background: '#131826', color: '#fff', border: '1px solid #2a3147', padding: 8, borderRadius: 4, fontSize: 12 }} />
      </Panel>

      {/* Mini Sidebar */}
      <Panel title="⭐ M37 · Mini Sidebar (Favoritos)">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['GitHub', 'HF', 'Claude', 'MiniMax'].map(s => (
            <span key={s} style={{ background: '#131826', color: '#9aa0a6', padding: '4px 10px', borderRadius: 3, fontSize: 11 }}>⭐ {s}</span>
          ))}
        </div>
      </Panel>

      {/* Dock inferior */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0a0e1a', borderTop: '1px solid #2a3147', padding: 8, display: 'flex', justifyContent: 'center', gap: 10 }}>
        {['Router', 'Logs', 'Terminal', 'Memoria', 'Estado'].map(d => (
          <span key={d} style={{ color: '#9aa0a6', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>📍 {d}</span>
        ))}
      </div>

      {/* Módulos */}
      <h2 style={{ color: '#4285f4', marginTop: 20, marginBottom: 10 }}>
        Módulos ({mode === 'novato' ? modulosNovato.length : modulos.length} visibles)
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 100 }}>
        {(mode === 'novato' ? modulosNovato : modulos).map(m => (
          <ModuleCard key={m.name} name={m.name} endpoint={m.ep} />
        ))}
      </div>

      {/* Logs en vivo */}
      <Panel title="📡 WebSocket /ws/router · {logs.length} mensajes">
        <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 10, fontFamily: 'monospace', color: '#5f6368' }}>
          {logs.slice(-10).map((l, i) => <div key={i}>{JSON.stringify(l)}</div>)}
        </div>
      </Panel>
    </div>
  )
}

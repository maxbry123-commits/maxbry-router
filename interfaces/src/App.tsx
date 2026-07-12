import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { client, api, API_BASE, type Resource, type Agent, type CatalogItem, type RouterConfig } from './api'
import './App.css'

type Area = 'recursos' | 'agentes' | 'router'
type InspectorTab = 'properties' | 'help' | 'diagnostics'
type ModalKind = 'newResource' | 'newAgent' | 'fromGithub'

// ============ APP ROOT ============
function App() {
  const [unlocked, setUnlocked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [area, setArea] = useState<Area>('agentes')
  const [selected, setSelected] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)

  // Detectar mobile en mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      setSidebarOpen(false)
      setInspectorOpen(false)
    }
  }, [])
  const [modal, setModal] = useState<ModalKind | null>(null)

  const notify = useCallback((kind: 'ok' | 'err' | 'info', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Check backend
  useEffect(() => {
    let cancelled = false
    const check = () => api.health().then(() => { if (!cancelled) setBackendOnline(true) }).catch(() => { if (!cancelled) setBackendOnline(false) })
    check()
    const t = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.toLowerCase() === 'max@maxbry-router.dev' && password === '770361793Max$') {
      setUnlocked(true)
      setError('')
    } else {
      setError('Credenciales incorrectas')
    }
  }

  // Auto-collapse sidebar on mobile when selecting item
  const handleSelect = useCallback((id: string) => {
    setSelected(id)
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      setSidebarOpen(false)
    }
  }, [])

  // Auto-close sidebar on area change in mobile
  const handleAreaChange = useCallback((a: Area) => {
    setArea(a)
    setSelected(null)
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      setSidebarOpen(true) // Open sidebar for new area
    }
  }, [])

  if (!unlocked) {
    return (
      <div className="mb5-login">
        <form className="mb5-login-form" onSubmit={handleUnlock}>
          <div className="mb5-login-logo">◉ MAXBRY · Centro de Control</div>
          <div className="mb5-login-sub">ROUTER UNIVERSAL · v6.2</div>
          <label>EMAIL DEL INGENIERO</label>
          <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="max@maxbry-router.dev" autoFocus />
          <label>CLAVE MAESTRA (CIFRADO AES-GCM-256)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" />
          {error && <div className="mb5-login-err">⚠ {error}</div>}
          <button type="submit">🔓 DESBLOQUEAR</button>
          <div className="mb5-login-footer">
            <span>Backend: {backendOnline ? '🟢 online' : '🔴 offline'}</span>
            <span>PBKDF2-SHA256 · 100k iter · AES-GCM-256</span>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mb5">
      <header className="mb5-topbar">
        <button className="mb5-iconbtn" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">☰</button>
        <div className="mb5-logo"><span className="mb5-logo-dot" />MAXBRY</div>
        <div className="mb5-area-tabs">
          <button className={area === 'recursos' ? 'active' : ''} onClick={() => handleAreaChange('recursos')}>📚 Recursos</button>
          <button className={area === 'agentes' ? 'active' : ''} onClick={() => handleAreaChange('agentes')}>🤖 Agentes</button>
          <button className={area === 'router' ? 'active' : ''} onClick={() => handleAreaChange('router')}>🔀 Router</button>
        </div>
        <div className="mb5-spacer" />
        <div className="mb5-status-dot" data-online={backendOnline}>{backendOnline ? '🟢 backend' : '🔴 offline'}</div>
        <button className="mb5-iconbtn" onClick={() => setInspectorOpen(o => !o)} title="Toggle inspector">⊟</button>
        <button className="mb5-btn" onClick={() => setUnlocked(false)}>🔒 Bloquear</button>
      </header>

      <div className="mb5-workbench" data-sidebar={sidebarOpen} data-inspector={inspectorOpen}>
        <ActivityBar area={area} onChange={handleAreaChange} />
        <div className="mb5-sidebar-wrap" data-open={sidebarOpen}>
          <PrimarySidebar area={area} selected={selected} onSelect={handleSelect} notify={notify} onNewResource={() => setModal('newResource')} onNewAgent={() => setModal('newAgent')} onFromGithub={() => setModal('fromGithub')} />
        </div>
        <main className="mb5-canvas">
          <CenterArea area={area} selected={selected} notify={notify} />
        </main>
        <div className="mb5-inspector-wrap" data-open={inspectorOpen}>
          <aside className="mb5-inspector">
            <InspectorTabBar tab={inspectorTab} onChange={setInspectorTab} />
            <InspectorBody area={area} selected={selected} tab={inspectorTab} />
          </aside>
        </div>
      </div>

      <footer className="mb5-statusbar">
        <span>v6.2</span><span>·</span>
        <span>Backend {backendOnline ? 'OK' : 'offline'}</span><span>·</span>
        <span>3 capas: GitHub → VPS → Destinos</span>
        <span className="mb5-spacer" />
        <span>{area.toUpperCase()}</span><span>·</span>
        <span>{selected || '—'}</span>
      </footer>

      {toast && <div className={`mb5-toast ${toast.kind}`}>{toast.text}</div>}

      {modal === 'newResource' && <NewResourceModal onClose={() => setModal(null)} onCreated={(r) => { notify('ok', `Recurso "${r.name}" creado`); setModal(null); }} notify={notify} />}
      {modal === 'newAgent' && <NewAgentModal onClose={() => setModal(null)} onCreated={(a) => { notify('ok', `Agente "${a.name}" creado`); setModal(null); }} notify={notify} />}
      {modal === 'fromGithub' && <FromGithubModal onClose={() => setModal(null)} onCreated={(a) => { notify('ok', `Agente "${a.name}" desde GitHub creado`); setModal(null); }} notify={notify} />}
    </div>
  )
}

// ============ ACTIVITY BAR (izquierda, iconos) ============
function ActivityBar({ area, onChange }: { area: Area; onChange: (a: Area) => void }) {
  return (
    <nav className="mb5-activity">
      <button className={area === 'recursos' ? 'active' : ''} onClick={() => onChange('recursos')} title="Recursos">
        <span className="icon">📚</span>
      </button>
      <button className={area === 'agentes' ? 'active' : ''} onClick={() => onChange('agentes')} title="Agentes">
        <span className="icon">🤖</span>
      </button>
      <button className={area === 'router' ? 'active' : ''} onClick={() => onChange('router')} title="Router">
        <span className="icon">🔀</span>
      </button>
    </nav>
  )
}

// ============ PRIMARY SIDEBAR (lista del área) ============
function PrimarySidebar({ area, selected, onSelect, notify, onNewResource, onNewAgent, onFromGithub }: any) {
  void selected; // compat
  return (
    <aside className="mb5-sidebar">
      {area === 'recursos' && <ResourcesSidebarContent onSelect={onSelect} notify={notify} onNew={onNewResource} />}
      {area === 'agentes' && <AgentsSidebarContent onSelect={onSelect} notify={notify} onNew={onNewAgent} onFromGithub={onFromGithub} />}
      {area === 'router' && <RouterSidebarContent />}
    </aside>
  )
}

function ResourcesSidebarContent({ onSelect, notify, onNew }: any) {
  const [resources, setResources] = useState<Resource[]>([])
  const [kinds, setKinds] = useState<Record<string, any>>({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [r, k] = await Promise.all([api.resources(), api.resourceKinds()])
      setResources(r.resources || [])
      setKinds(k.kinds || {})
    } catch (e: any) { notify('err', 'Error cargando recursos: ' + e.message) }
    finally { setLoading(false) }
  }, [notify])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => resources.filter(r =>
    !filter || r.name?.toLowerCase().includes(filter.toLowerCase()) || r.id.includes(filter.toLowerCase()) || r.kind?.includes(filter.toLowerCase())
  ), [resources, filter])

  return (
    <>
      <div className="mb5-sidebar-header">
        <span>RECURSOS</span>
        <span className="count">{resources.length}</span>
      </div>
      <div className="mb5-sidebar-actions">
        <button onClick={reload} title="Recargar" disabled={loading}>{loading ? '⏳' : '↻'}</button>
        <button onClick={onNew} title="Nuevo recurso">+ Nuevo</button>
      </div>
      <input className="mb5-search" placeholder="Buscar por nombre, id o tipo..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="mb5-sidebar-list">
        {filtered.map(r => (
          <div key={r.id} className={`mb5-sidebar-item ${selected === r.id ? 'active' : ''}`} onClick={() => { setSelected(r.id); onSelect(r.id) }}>
            <span className="icon">{kinds[r.kind]?.icon || '📦'}</span>
            <div className="info">
              <div className="name">{r.name}</div>
              <div className="meta">{r.kind}{r.state ? ` · ${r.state}` : ''}</div>
            </div>
            <span className={`status ${r.state || 'active'}`} />
          </div>
        ))}
        {filtered.length === 0 && !loading && <div className="mb5-empty">Sin recursos. Pulsa + para crear uno.</div>}
        {loading && <div className="mb5-empty">Cargando...</div>}
      </div>
    </>
  )
}

function AgentsSidebarContent({ onSelect, notify, onNew, onFromGithub }: any) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.agents()
      setAgents(d.agents || [])
    } catch (e: any) { notify('err', 'Error: ' + e.message) }
    finally { setLoading(false) }
  }, [notify])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => agents.filter(a => !filter || a.name?.toLowerCase().includes(filter.toLowerCase()) || a.id.includes(filter.toLowerCase()) || a.model?.includes(filter.toLowerCase())), [agents, filter])

  return (
    <>
      <div className="mb5-sidebar-header">
        <span>AGENTES</span>
        <span className="count">{agents.length}</span>
      </div>
      <div className="mb5-sidebar-actions">
        <button onClick={reload} title="Recargar" disabled={loading}>{loading ? '⏳' : '↻'}</button>
        <button onClick={onNew} title="Nuevo agente">+ Nuevo</button>
        <button onClick={onFromGithub} title="Desde GitHub">🐙</button>
      </div>
      <input className="mb5-search" placeholder="Buscar por nombre, id o modelo..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="mb5-sidebar-list">
        {filtered.map(a => (
          <div key={a.id} className={`mb5-sidebar-item ${selected === a.id ? 'active' : ''}`} onClick={() => { setSelected(a.id); onSelect(a.id) }}>
            <span className="icon">{a.source === 'github' ? '🐙' : '🤖'}</span>
            <div className="info">
              <div className="name">{a.name}</div>
              <div className="meta">{a.model} · P{a.priority}</div>
            </div>
            <span className={`status ${a.state || 'active'}`} />
          </div>
        ))}
        {filtered.length === 0 && !loading && <div className="mb5-empty">Sin agentes. Pulsa + para crear uno.</div>}
        {loading && <div className="mb5-empty">Cargando...</div>}
      </div>
    </>
  )
}

function RouterSidebarContent() {
  return (
    <>
      <div className="mb5-sidebar-header"><span>ROUTER</span><span className="count">⚙</span></div>
      <div className="mb5-sidebar-list" style={{ padding: 16, fontSize: 11, color: 'var(--gray-2)', lineHeight: 1.6 }}>
        <p style={{ marginBottom: 8 }}>El Router es el orquestador del enrutamiento entre entradas, agentes y destinos.</p>
        <p style={{ marginBottom: 8 }}>Selecciona una opción del centro para editar:</p>
        <ul style={{ paddingLeft: 16, listStyle: 'none' }}>
          <li>→ Entradas</li>
          <li>→ Salidas / Destinos</li>
          <li>→ Prioridades</li>
          <li>→ Fallback</li>
          <li>→ Consensus</li>
          <li>→ Recovery</li>
          <li>→ Chat con M3</li>
        </ul>
        <p style={{ marginTop: 12, fontSize: 10, opacity: 0.7 }}>3 capas: GitHub → VPS → Destinos</p>
      </div>
    </>
  )
}

// ============ CENTER AREA (ficha) ============
function CenterArea({ area, selected, notify }: { area: Area; selected: string | null; notify: any }) {
  return (
    <div className="mb5-center-wrap">
      <div style={{ display: area === 'recursos' ? 'block' : 'none' }}>
        <ResourceDetail id={area === 'recursos' ? selected : null} notify={notify} />
      </div>
      <div style={{ display: area === 'agentes' ? 'block' : 'none' }}>
        <AgentDetail id={area === 'agentes' ? selected : null} notify={notify} />
      </div>
      <div style={{ display: area === 'router' ? 'block' : 'none' }}>
        <RouterCenter notify={notify} />
      </div>
    </div>
  )
}

function ResourceDetail({ id, notify }: { id: string | null; notify: any }) {
  const [resource, setResource] = useState<Resource | null>(null)
  const [kinds, setKinds] = useState<Record<string, any>>({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Resource | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.resourceKinds().then(d => setKinds(d.kinds || {})).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) { setResource(null); setDraft(null); return }
    setEditing(false)
    api.resource(id)
      .then(d => { setResource(d); setDraft(d) })
      .catch((e: any) => notify('err', e.message))
  }, [id, notify])

  if (!id) {
    return (
      <div className="mb5-empty-canvas">
        <h2>📚 Recursos</h2>
        <p>Selecciona un recurso de la izquierda o crea uno nuevo.</p>
        <p className="hint">Los recursos se reutilizan en cualquier agente. Configúralos una vez.</p>
      </div>
    )
  }
  if (!resource || !draft) return <div className="mb5-empty-canvas"><span style={{ fontFamily: 'var(--mono)' }}>⏳ Cargando...</span></div>

  const fields = kinds[resource.kind]?.fields || ['name', 'kind']
  const isDirty = JSON.stringify(resource) !== JSON.stringify(draft)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await api.updateResource(id, draft)
      if (r.ok) { setResource(r.resource); setDraft(r.resource); setEditing(false); notify('ok', `Recurso "${r.resource.name}" guardado`) }
      else notify('err', 'Error guardando')
    } catch (e: any) { notify('err', e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar recurso "${resource.name}"?`)) return
    try {
      const r = await api.deleteResource(id)
      if (r.ok) notify('ok', 'Recurso eliminado')
    } catch (e: any) { notify('err', e.message) }
  }

  return (
    <div className="mb5-detail">
      <div className="mb5-detail-header">
        <span className="icon-big">{kinds[resource.kind]?.icon || '📦'}</span>
        <div>
          {editing ? (
            <input className="mb5-input title" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          ) : (
            <h2>{resource.name}</h2>
          )}
          <div className="subtitle">{kinds[resource.kind]?.label || resource.kind} · {resource.id}</div>
        </div>
        <div className="actions">
          {editing ? (
            <>
              <button className="mb5-btn primary" onClick={handleSave} disabled={!isDirty || saving}>{saving ? '⏳ Guardando…' : '💾 Guardar'}</button>
              <button className="mb5-btn" onClick={() => { setDraft(resource); setEditing(false) }}>Cancelar</button>
            </>
          ) : (
            <>
              <button className="mb5-btn" onClick={() => setEditing(true)}>✎ Editar</button>
              <button className="mb5-btn danger" onClick={handleDelete}>🗑 Eliminar</button>
            </>
          )}
        </div>
      </div>

      <div className="mb5-form">
        {fields.map((f: string) => (
          <div className="mb5-form-row" key={f}>
            <label>{f.replace(/_/g, ' ')}</label>
            {editing ? (
              f === 'api_key' || f === 'token' || f === 'ssh_key' || f === 'client_secret' || f === 'refresh_token' || f === 'password' ? (
                <input className="mb5-input" type="password" placeholder="(sin cambios)" value={(draft as any)[f] || ''} onChange={e => setDraft({ ...draft, [f]: e.target.value })} />
              ) : f === 'state' ? (
                <select className="mb5-input" value={(draft as any)[f] || 'active'} onChange={e => setDraft({ ...draft, [f]: e.target.value })}>
                  <option value="active">active</option>
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                  <option value="inactive">inactive</option>
                </select>
              ) : f === 'description' || f === 'notes' ? (
                <textarea className="mb5-input" rows={3} value={(draft as any)[f] || ''} onChange={e => setDraft({ ...draft, [f]: e.target.value })} />
              ) : (
                <input className="mb5-input" value={(draft as any)[f] || ''} onChange={e => setDraft({ ...draft, [f]: e.target.value })} />
              )
            ) : (
              <div className="mb5-value">{(resource as any)[f] || <span className="empty">—</span>}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentDetail({ id, notify }: { id: string | null; notify: any }) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [draft, setDraft] = useState<Agent | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'general' | 'entradas' | 'salidas' | 'recursos'>('general')
  const [inputs, setInputs] = useState<CatalogItem[]>([])
  const [outputs, setOutputs] = useState<CatalogItem[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.agentInputs(), api.agentOutputs(), api.resources()]).then(([i, o, r]) => {
      setInputs(i.inputs || [])
      setOutputs(o.outputs || [])
      setResources(r.resources || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) { setAgent(null); setDraft(null); return }
    setEditing(false)
    api.agent(id)
      .then(d => { setAgent(d); setDraft(d) })
      .catch((e: any) => notify('err', e.message))
  }, [id, notify])

  const filteredInputs = useMemo(() => inputs.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase()) || i.id.includes(filter.toLowerCase())), [inputs, filter])
  const filteredOutputs = useMemo(() => outputs.filter(o => !filter || o.label.toLowerCase().includes(filter.toLowerCase()) || o.id.includes(filter.toLowerCase())), [outputs, filter])
  const filteredResources = useMemo(() => resources.filter(r => !filter || r.name?.toLowerCase().includes(filter.toLowerCase())), [resources, filter])

  if (!id) {
    return (
      <div className="mb5-empty-canvas">
        <h2>🤖 Agentes</h2>
        <p>Selecciona un agente de la izquierda o crea uno nuevo.</p>
        <p className="hint">Cada agente define sus entradas, salidas y los recursos que consume.</p>
      </div>
    )
  }
  if (!agent || !draft) return <div className="mb5-empty-canvas"><span style={{ fontFamily: 'var(--mono)' }}>⏳ Cargando...</span></div>

  const isDirty = JSON.stringify(agent) !== JSON.stringify(draft)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await api.updateAgent(id, draft)
      if (r.ok) { setAgent(r.agent); setDraft(r.agent); setEditing(false); notify('ok', `Agente "${r.agent.name}" guardado`) }
      else notify('err', 'Error guardando')
    } catch (e: any) { notify('err', e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar agente "${agent.name}"?`)) return
    try {
      const r = await api.deleteAgent(id)
      if (r.ok) notify('ok', 'Agente eliminado')
    } catch (e: any) { notify('err', e.message) }
  }

  const toggleEntrada = (eid: string) => {
    if (!draft) return
    setDraft({ ...draft, entradas: { ...draft.entradas, [eid]: !draft.entradas[eid] } })
  }
  const toggleAllEntradas = (val: boolean) => {
    if (!draft) return
    const e: Record<string, boolean> = {}
    inputs.forEach(i => { e[i.id] = val })
    setDraft({ ...draft, entradas: e })
  }
  const toggleSalida = (oid: string) => {
    if (!draft) return
    setDraft({ ...draft, salidas: { ...draft.salidas, [oid]: !draft.salidas[oid] } })
  }
  const toggleAllSalidas = (val: boolean) => {
    if (!draft) return
    const s: Record<string, boolean> = {}
    outputs.forEach(o => { s[o.id] = val })
    setDraft({ ...draft, salidas: s })
  }
  const toggleRecurso = (rid: string) => {
    if (!draft) return
    const list = draft.recursos || []
    setDraft({ ...draft, recursos: list.includes(rid) ? list.filter(r => r !== rid) : [...list, rid] })
  }

  return (
    <div className="mb5-detail">
      <div className="mb5-detail-header">
        <span className="icon-big">{agent.source === 'github' ? '🐙' : '🤖'}</span>
        <div>
          {editing ? (
            <input className="mb5-input title" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          ) : (
            <h2>{agent.name}</h2>
          )}
          <div className="subtitle">{agent.role} · {agent.model} · {agent.id}{agent.github_url ? ` · 🐙 ${agent.github_org}/${agent.github_repo}` : ''}</div>
        </div>
        <div className="actions">
          {editing ? (
            <>
              <button className="mb5-btn primary" onClick={handleSave} disabled={!isDirty || saving}>{saving ? '⏳ Guardando…' : '💾 Guardar cambios'}</button>
              <button className="mb5-btn" onClick={() => { setDraft(agent); setEditing(false) }}>Cancelar</button>
            </>
          ) : (
            <>
              <button className="mb5-btn primary" onClick={() => setEditing(true)}>✎ Editar</button>
              <button className="mb5-btn danger" onClick={handleDelete}>🗑 Eliminar</button>
            </>
          )}
        </div>
      </div>

      <div className="mb5-tabs">
        {(['general', 'entradas', 'salidas', 'recursos'] as const).map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div className="mb5-tab-body">
        {editing && (tab === 'entradas' || tab === 'salidas' || tab === 'recursos') && (
          <input className="mb5-search" style={{ marginBottom: 12 }} placeholder="Filtrar catálogo..." value={filter} onChange={e => setFilter(e.target.value)} />
        )}

        {tab === 'general' && (
          <div className="mb5-form">
            <div className="mb5-form-row">
              <label>role</label>
              {editing ? (
                <select className="mb5-input" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>
                  <option>executor</option>
                  <option>planner</option>
                  <option>reviewer</option>
                </select>
              ) : <div className="mb5-value">{agent.role}</div>}
            </div>
            <div className="mb5-form-row">
              <label>provider</label>
              {editing ? (
                <select className="mb5-input" value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value })}>
                  <option>litellm</option>
                  <option>openrouter</option>
                  <option>huggingface</option>
                </select>
              ) : <div className="mb5-value">{agent.provider}</div>}
            </div>
            <div className="mb5-form-row">
              <label>model</label>
              {editing ? (
                <input className="mb5-input" value={draft.model} onChange={e => setDraft({ ...draft, model: e.target.value })} />
              ) : <div className="mb5-value">{agent.model}</div>}
            </div>
            <div className="mb5-form-row">
              <label>priority (1-99)</label>
              {editing ? (
                <input className="mb5-input" type="number" min="1" max="99" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} />
              ) : <div className="mb5-value">P{agent.priority}</div>}
            </div>
            <div className="mb5-form-row">
              <label>state</label>
              {editing ? (
                <select className="mb5-input" value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })}>
                  <option>active</option>
                  <option>paused</option>
                  <option>inactive</option>
                </select>
              ) : <div className="mb5-value">{agent.state}</div>}
            </div>
            {agent.github_url && (
              <div className="mb5-form-row">
                <label>github</label>
                <div className="mb5-value"><a href={agent.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{agent.github_org}/{agent.github_repo}</a></div>
              </div>
            )}
            {agent.description && (
              <div className="mb5-form-row" style={{ gridTemplateColumns: '1fr' }}>
                <label>description</label>
                <div className="mb5-value" style={{ fontFamily: 'var(--sans)' }}>{agent.description}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'entradas' && (
          <div>
            <div className="mb5-bulk-actions">
              <span>Selecciona las entradas ({filteredInputs.length} de {inputs.length}) que aceptará este agente:</span>
              {editing && (
                <>
                  <button className="mb5-btn" onClick={() => toggleAllEntradas(true)}>☑ Seleccionar todas</button>
                  <button className="mb5-btn" onClick={() => toggleAllEntradas(false)}>☐ Ninguna</button>
                </>
              )}
            </div>
            <div className="mb5-catalog-grid">
              {filteredInputs.map(i => {
                const on = (editing ? draft.entradas[i.id] : agent.entradas[i.id]) ?? false
                return (
                  <div key={i.id} className={`mb5-catalog-item ${on ? 'on' : ''} ${!editing ? 'readonly' : ''}`} onClick={() => editing && toggleEntrada(i.id)}>
                    <div className="icon">{i.icon}</div>
                    <div className="label">{i.label}</div>
                    <div className="check">{on ? '☑' : '☐'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'salidas' && (
          <div>
            <div className="mb5-bulk-actions">
              <span>Salidas / Destinos ({filteredOutputs.length} de {outputs.length}):</span>
              {editing && (
                <>
                  <button className="mb5-btn" onClick={() => toggleAllSalidas(true)}>☑ Seleccionar todas</button>
                  <button className="mb5-btn" onClick={() => toggleAllSalidas(false)}>☐ Ninguna</button>
                </>
              )}
            </div>
            <div className="mb5-catalog-grid">
              {filteredOutputs.map(o => {
                const on = (editing ? draft.salidas[o.id] : agent.salidas[o.id]) ?? false
                return (
                  <div key={o.id} className={`mb5-catalog-item ${on ? 'on' : ''} ${!editing ? 'readonly' : ''}`} onClick={() => editing && toggleSalida(o.id)}>
                    <div className="icon">{o.icon}</div>
                    <div className="label">{o.label}</div>
                    <div className="check">{on ? '☑' : '☐'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'recursos' && (
          <div>
            <div className="mb5-bulk-actions">
              <span>Recursos de la biblioteca ({filteredResources.length} de {resources.length}) que este agente puede usar:</span>
              {editing && <button className="mb5-btn" onClick={() => setDraft({ ...draft, recursos: resources.map(r => r.id) })}>☑ Seleccionar todos</button>}
            </div>
            <div className="mb5-catalog-grid">
              {filteredResources.map(r => {
                const on = (draft.recursos || []).includes(r.id)
                return (
                  <div key={r.id} className={`mb5-catalog-item ${on ? 'on' : ''} ${!editing ? 'readonly' : ''}`} onClick={() => editing && toggleRecurso(r.id)}>
                    <div className="icon">📦</div>
                    <div className="label">{r.name}</div>
                    <div className="check">{on ? '☑' : '☐'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RouterCenter({ notify }: { notify: any }) {
  const [config, setConfig] = useState<RouterConfig | null>(null)
  const [draft, setDraft] = useState<RouterConfig | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'entradas' | 'salidas' | 'orden' | 'prioridades' | 'fallback' | 'consensus' | 'recovery' | 'chat'>('entradas')
  const [inputs, setInputs] = useState<CatalogItem[]>([])
  const [outputs, setOutputs] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const reload = useCallback(async () => {
    const [c, i, o] = await Promise.all([api.routerConfig(), api.agentInputs(), api.agentOutputs()])
    setConfig(c); setDraft(c); setInputs(i.inputs || []); setOutputs(o.outputs || [])
  }, [])

  useEffect(() => { reload() }, [reload])

  const filteredInputs = useMemo(() => inputs.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase()) || i.id.includes(filter.toLowerCase())), [inputs, filter])
  const filteredOutputs = useMemo(() => outputs.filter(o => !filter || o.label.toLowerCase().includes(filter.toLowerCase()) || o.id.includes(filter.toLowerCase())), [outputs, filter])

  if (!config || !draft) return <div className="mb5-empty-canvas"><span style={{ fontFamily: 'var(--mono)' }}>⏳ Cargando configuración...</span></div>

  const isDirty = JSON.stringify(config) !== JSON.stringify(draft)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await api.saveRouterConfig(draft)
      if (r.ok) { setConfig(r.config); setDraft(r.config); setEditing(false); notify('ok', 'Configuración del Router guardada') }
      else notify('err', 'Error guardando')
    } catch (e: any) { notify('err', e.message) }
    finally { setSaving(false) }
  }

  const toggleEntrada = (eid: string) => {
    setDraft({ ...draft, entradas: draft.entradas.includes(eid) ? draft.entradas.filter(e => e !== eid) : [...draft.entradas, eid] })
  }
  const toggleSalida = (oid: string) => {
    setDraft({ ...draft, salidas: draft.salidas.includes(oid) ? draft.salidas.filter(s => s !== oid) : [...draft.salidas, oid] })
  }
  const setPriority = (key: string, val: number) => {
    setDraft({ ...draft, prioridades: { ...draft.prioridades, [key]: val } })
  }
  const setFallback = (key: string, val: string) => {
    setDraft({ ...draft, fallback: { ...draft.fallback, [key]: val } })
  }
  const setOrden = (idx: number, dir: -1 | 1) => {
    const o = [...draft.orden]
    if (idx + dir < 0 || idx + dir >= o.length) return
    [o[idx], o[idx + dir]] = [o[idx + dir], o[idx]]
    setDraft({ ...draft, orden: o })
  }

  return (
    <div className="mb5-detail">
      <div className="mb5-detail-header">
        <span className="icon-big">🔀</span>
        <div>
          <h2>Router Universal</h2>
          <div className="subtitle">Configuración global del enrutador · 3 capas: GitHub → VPS → Destinos</div>
        </div>
        <div className="actions">
          {editing ? (
            <>
              <button className="mb5-btn primary" onClick={handleSave} disabled={!isDirty || saving}>{saving ? '⏳ Guardando…' : '💾 Guardar'}</button>
              <button className="mb5-btn" onClick={() => { setDraft(config); setEditing(false) }}>Cancelar</button>
            </>
          ) : (
            <button className="mb5-btn primary" onClick={() => setEditing(true)}>✎ Editar</button>
          )}
        </div>
      </div>

      <div className="mb5-tabs">
        {(['entradas', 'salidas', 'orden', 'prioridades', 'fallback', 'consensus', 'recovery', 'chat'] as const).map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div className="mb5-tab-body">
        {editing && (tab === 'entradas' || tab === 'salidas') && (
          <input className="mb5-search" style={{ marginBottom: 12 }} placeholder="Filtrar..." value={filter} onChange={e => setFilter(e.target.value)} />
        )}

        {tab === 'entradas' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Entradas que el Router aceptará. Selecciona todas las que necesites.</p>
            <div className="mb5-bulk-actions">
              {editing && (
                <>
                  <button className="mb5-btn" onClick={() => setDraft({ ...draft, entradas: inputs.map(i => i.id) })}>☑ Seleccionar todas</button>
                  <button className="mb5-btn" onClick={() => setDraft({ ...draft, entradas: [] })}>☐ Ninguna</button>
                </>
              )}
            </div>
            <div className="mb5-catalog-grid">
              {filteredInputs.map(i => {
                const on = (editing ? draft.entradas.includes(i.id) : config.entradas.includes(i.id))
                return (
                  <div key={i.id} className={`mb5-catalog-item ${on ? 'on' : ''} ${!editing ? 'readonly' : ''}`} onClick={() => editing && toggleEntrada(i.id)}>
                    <div className="icon">{i.icon}</div>
                    <div className="label">{i.label}</div>
                    <div className="check">{on ? '☑' : '☐'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'salidas' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Salidas / Destinos. Cada una tiene prioridad editable en la pestaña PRIORIDADES.</p>
            <div className="mb5-bulk-actions">
              {editing && (
                <>
                  <button className="mb5-btn" onClick={() => setDraft({ ...draft, salidas: outputs.map(o => o.id) })}>☑ Seleccionar todas</button>
                  <button className="mb5-btn" onClick={() => setDraft({ ...draft, salidas: [] })}>☐ Ninguna</button>
                </>
              )}
            </div>
            <div className="mb5-catalog-grid">
              {filteredOutputs.map(o => {
                const on = (editing ? draft.salidas.includes(o.id) : config.salidas.includes(o.id))
                const priority = (editing ? draft.prioridades[o.id] : config.prioridades[o.id]) || 99
                return (
                  <div key={o.id} className={`mb5-catalog-item ${on ? 'on' : ''} ${!editing ? 'readonly' : ''}`} onClick={() => editing && toggleSalida(o.id)}>
                    <div className="icon">{o.icon}</div>
                    <div className="label">{o.label}</div>
                    <div className="check">{on ? '☑' : '☐'}</div>
                    {on && <div className="priority">P{priority}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'orden' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Orden de ejecución de las salidas (arrastre conceptual con ↑↓). El primero se ejecuta primero.</p>
            <div className="mb5-order-list">
              {(editing ? draft.orden : config.orden).map((k, idx, arr) => (
                <div key={k} className="mb5-order-row">
                  <span className="idx">{idx + 1}</span>
                  <span className="key">{k}</span>
                  {editing && (
                    <div className="actions">
                      <button className="mb5-btn" onClick={() => setOrden(idx, -1)} disabled={idx === 0}>↑</button>
                      <button className="mb5-btn" onClick={() => setOrden(idx, 1)} disabled={idx === arr.length - 1}>↓</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'prioridades' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Orden numérico de ejecución. Menor número = mayor prioridad.</p>
            <div className="mb5-priority-list">
              {Object.entries(editing ? draft.prioridades : config.prioridades).map(([k, v]) => (
                <div key={k} className="mb5-form-row">
                  <label>{k}</label>
                  {editing ? (
                    <input className="mb5-input" type="number" min="1" max="99" value={v} onChange={e => setPriority(k, Number(e.target.value))} />
                  ) : (
                    <div className="mb5-value">P{v}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'fallback' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Si el destino primario falla, salta a este.</p>
            <div className="mb5-fallback-list">
              {Object.entries(editing ? draft.fallback : config.fallback).map(([k, v]) => (
                <div key={k} className="mb5-form-row">
                  <label>{k}</label>
                  {editing ? (
                    <select className="mb5-input" value={v} onChange={e => setFallback(k, e.target.value)}>
                      <option value="">— ninguno —</option>
                      {outputs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  ) : (
                    <div className="mb5-value">→ {v}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'consensus' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Consenso: el Router pregunta a N modelos y compara antes de responder.</p>
            <div className="mb5-form-row">
              <label>enabled</label>
              {editing ? (
                <input type="checkbox" checked={draft.consensus.enabled} onChange={e => setDraft({ ...draft, consensus: { ...draft.consensus, enabled: e.target.checked } })} />
              ) : <div className="mb5-value">{config.consensus.enabled ? '✅' : '❌'}</div>}
            </div>
            <div className="mb5-form-row">
              <label>voting</label>
              {editing ? (
                <select className="mb5-input" value={draft.consensus.voting} onChange={e => setDraft({ ...draft, consensus: { ...draft.consensus, voting: e.target.value } })}>
                  <option>majority</option>
                  <option>unanimous</option>
                  <option>weighted</option>
                </select>
              ) : <div className="mb5-value">{config.consensus.voting}</div>}
            </div>
            <div className="mb5-form-row">
              <label>modelos (coma-sep)</label>
              {editing ? (
                <input className="mb5-input" value={draft.consensus.modelos.join(', ')} onChange={e => setDraft({ ...draft, consensus: { ...draft.consensus, modelos: e.target.value.split(',').map(s => s.trim()) } })} />
              ) : <div className="mb5-value">{config.consensus.modelos.join(', ')}</div>}
            </div>
          </div>
        )}

        {tab === 'recovery' && (
          <div>
            <p style={{ color: 'var(--gray-2)', fontSize: 11, marginBottom: 12 }}>Auto-recovery, reintentos, circuit breaker.</p>
            <div className="mb5-form-row">
              <label>enabled</label>
              {editing ? (
                <input type="checkbox" checked={draft.recovery.enabled} onChange={e => setDraft({ ...draft, recovery: { ...draft.recovery, enabled: e.target.checked } })} />
              ) : <div className="mb5-value">{config.recovery.enabled ? '✅' : '❌'}</div>}
            </div>
            <div className="mb5-form-row">
              <label>max_retries (0-10)</label>
              {editing ? (
                <input className="mb5-input" type="number" min="0" max="10" value={draft.recovery.max_retries} onChange={e => setDraft({ ...draft, recovery: { ...draft.recovery, max_retries: Number(e.target.value) } })} />
              ) : <div className="mb5-value">{config.recovery.max_retries}</div>}
            </div>
            <div className="mb5-form-row">
              <label>backoff_s (0-60)</label>
              {editing ? (
                <input className="mb5-input" type="number" min="0" max="60" value={draft.recovery.backoff_s} onChange={e => setDraft({ ...draft, recovery: { ...draft.recovery, backoff_s: Number(e.target.value) } })} />
              ) : <div className="mb5-value">{config.recovery.backoff_s}</div>}
            </div>
            <div className="mb5-form-row">
              <label>circuit_breaker_threshold (1-20)</label>
              {editing ? (
                <input className="mb5-input" type="number" min="1" max="20" value={draft.recovery.circuit_breaker_threshold} onChange={e => setDraft({ ...draft, recovery: { ...draft.recovery, circuit_breaker_threshold: Number(e.target.value) } })} />
              ) : <div className="mb5-value">{config.recovery.circuit_breaker_threshold}</div>}
            </div>
          </div>
        )}
        {tab === 'chat' && <RouterChatTab />}
      </div>
    </div>
  )
}

function RouterChatTab() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'system', content: 'Eres el Router MAXBRY. Respondes en español, breve y concreto.' }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('minimaxai/minimax-m3')
  const [usage, setUsage] = useState<{ prompt: number; completion: number; total: number }>({ prompt: 0, completion: 0, total: 0 })
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setError(null)
    setSending(true)
    const userMsg = { role: 'user', content: input }
    const allMessages = [...messages, userMsg]
    setMessages(allMessages)
    setInput('')
    try {
      const r = await client.routerChat(allMessages, model)
      if (r.ok && r.message) {
        setMessages([...allMessages, r.message])
        if (r.usage) {
          setUsage(prev => ({
            prompt: prev.prompt + (r.usage.prompt_tokens || 0),
            completion: prev.completion + (r.usage.completion_tokens || 0),
            total: prev.total + (r.usage.total_tokens || 0)
          }))
        }
      } else {
        setError(r.error || 'Error desconocido')
        setMessages(messages) // rollback
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const handleClear = () => {
    setMessages([{ role: 'system', content: 'Eres el Router MAXBRY. Respondes en español, breve y concreto.' }])
    setUsage({ prompt: 0, completion: 0, total: 0 })
    setError(null)
  }

  return (
    <div className="mb5-chat">
      <div className="mb5-chat-header">
        <div>
          <strong style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 13 }}>Chat del Router</strong>
          <span style={{ marginLeft: 12, color: 'var(--gray-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>{usage.total} tokens · {usage.prompt}p/{usage.completion}c · {model}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="mb5-input" style={{ fontSize: 10, padding: '4px 8px' }} value={model} onChange={e => setModel(e.target.value)}>
            <option value="minimaxai/minimax-m3">minimaxai/minimax-m3</option>
          </select>
          <button className="mb5-btn" style={{ fontSize: 10 }} onClick={handleClear}>Limpiar</button>
        </div>
      </div>
      <div className="mb5-chat-log" ref={chatRef}>
        {messages.slice(1).length === 0 && !sending && (
          <div style={{ color: 'var(--gray-2)', fontSize: 12, textAlign: 'center', padding: 24, fontStyle: 'italic' }}>
            Empieza a chatear con M3. Ejemplos: "Resume el estado del router", "Sugiere prioridades", "Crea un agente"
          </div>
        )}
        {messages.slice(1).map((m: any, i: number) => (
          <div key={i} className={`mb5-chat-msg ${m.role}`}>
            <div className="role">{m.role === 'user' ? '👤 tú' : '🤖 ' + model.split('/').pop()}</div>
            <div className="content">{m.content || <i>pensando…</i>}</div>
          </div>
        ))}
        {sending && (
          <div className="mb5-chat-msg assistant">
            <div className="role">🤖 {model.split('/').pop()}</div>
            <div className="content"><i>⏳ pensando…</i></div>
          </div>
        )}
        {error && <div className="mb5-chat-err">⚠ {error}</div>}
      </div>
      <div className="mb5-chat-input">
        <textarea
          className="mb5-input"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() } }}
          placeholder="Escribe un mensaje. Cmd/Ctrl+Enter para enviar."
          disabled={sending}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--gray-2)', fontFamily: 'var(--mono)', fontSize: 10 }}>{input.length} chars · {sending ? 'enviando…' : 'listo'}</span>
          <button className="mb5-btn primary" onClick={handleSend} disabled={sending || !input.trim()}>{sending ? '⏳ Enviando…' : '▶ Enviar (⌘+Enter)'}</button>
        </div>
      </div>
    </div>
  )
}

// ============ MODALES ============
function NewResourceModal({ onClose, onCreated, notify }: { onClose: () => void; onCreated: (r: Resource) => void; notify: any }) {
  const [kinds, setKinds] = useState<Record<string, any>>({})
  const [kind, setKind] = useState<string>('')
  const [name, setName] = useState('')
  const [state, setState] = useState('active')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.resourceKinds().then(d => {
      setKinds(d.kinds || {})
      const first = Object.keys(d.kinds || {})[0]
      if (first) setKind(first)
    }).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || !kind) { notify('err', 'Nombre y tipo requeridos'); return }
    setCreating(true)
    try {
      const r = await api.createResource({ name, kind, state, ...fields })
      if (r.ok) onCreated(r.resource)
      else notify('err', 'Error creando')
    } catch (e: any) {
      notify('err', e.message)
    } finally {
      setCreating(false)
    }
  }

  const kindDef = kinds[kind]
  const fieldList: string[] = kindDef?.fields || []

  return (
    <div className="mb5-modal-bg" onClick={onClose}>
      <div className="mb5-modal" onClick={e => e.stopPropagation()}>
        <div className="mb5-modal-header">
          <span className="icon-big">{kindDef?.icon || '📦'}</span>
          <div>
            <h3>Nuevo Recurso</h3>
            <div className="subtitle">Configura un recurso reutilizable</div>
          </div>
          <button className="mb5-iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="mb5-modal-body">
          <div className="mb5-form-row">
            <label>tipo</label>
            <select className="mb5-input" value={kind} onChange={e => { setKind(e.target.value); setFields({}) }}>
              {Object.entries(kinds).map(([k, v]: any) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div className="mb5-form-row">
            <label>nombre</label>
            <input className="mb5-input" placeholder="Mi Recurso" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="mb5-form-row">
            <label>estado</label>
            <select className="mb5-input" value={state} onChange={e => setState(e.target.value)}>
              <option value="active">active</option>
              <option value="online">online</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          {fieldList.filter(f => f !== 'name' && f !== 'kind' && f !== 'state').map(f => (
            <div className="mb5-form-row" key={f}>
              <label>{f.replace(/_/g, ' ')}</label>
              <input
                className="mb5-input"
                type={f.includes('key') || f.includes('token') || f.includes('secret') ? 'password' : 'text'}
                placeholder={f.includes('endpoint') || f.includes('url') ? 'https://...' : ''}
                value={fields[f] || ''}
                onChange={e => setFields({ ...fields, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="mb5-modal-footer">
          <button className="mb5-btn" onClick={onClose}>Cancelar</button>
          <button className="mb5-btn primary" onClick={handleCreate} disabled={!name.trim() || creating}>{creating ? '⏳ Creando…' : '💾 Crear'}</button>
        </div>
      </div>
    </div>
  )
}

function NewAgentModal({ onClose, onCreated, notify }: { onClose: () => void; onCreated: (a: Agent) => void; notify: any }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('executor')
  const [provider, setProvider] = useState('litellm')
  const [model, setModel] = useState('claude-sonnet-4.5')
  const [priority, setPriority] = useState(1)
  const [state, setState] = useState('active')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) { notify('err', 'Nombre requerido'); return }
    setCreating(true)
    try {
      const r = await api.createAgent({ name, role, provider, model, priority, state, description })
      if (r.ok) onCreated(r.agent)
      else notify('err', 'Error creando')
    } catch (e: any) {
      notify('err', e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb5-modal-bg" onClick={onClose}>
      <div className="mb5-modal" onClick={e => e.stopPropagation()}>
        <div className="mb5-modal-header">
          <span className="icon-big">🤖</span>
          <div>
            <h3>Nuevo Agente</h3>
            <div className="subtitle">Crea un agente desde cero</div>
          </div>
          <button className="mb5-iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="mb5-modal-body">
          <div className="mb5-form-row">
            <label>nombre</label>
            <input className="mb5-input" placeholder="Mi Agente" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="mb5-form-row">
            <label>descripción</label>
            <textarea className="mb5-input" rows={2} placeholder="¿Qué hace este agente?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="mb5-form-row">
            <label>role</label>
            <select className="mb5-input" value={role} onChange={e => setRole(e.target.value)}>
              <option>executor</option>
              <option>planner</option>
              <option>reviewer</option>
            </select>
          </div>
          <div className="mb5-form-row">
            <label>provider</label>
            <select className="mb5-input" value={provider} onChange={e => setProvider(e.target.value)}>
              <option>litellm</option>
              <option>openrouter</option>
              <option>huggingface</option>
            </select>
          </div>
          <div className="mb5-form-row">
            <label>modelo</label>
            <input className="mb5-input" value={model} onChange={e => setModel(e.target.value)} />
          </div>
          <div className="mb5-form-row">
            <label>priority (1-99)</label>
            <input className="mb5-input" type="number" min="1" max="99" value={priority} onChange={e => setPriority(Number(e.target.value))} />
          </div>
          <div className="mb5-form-row">
            <label>estado</label>
            <select className="mb5-input" value={state} onChange={e => setState(e.target.value)}>
              <option>active</option>
              <option>paused</option>
              <option>inactive</option>
            </select>
          </div>
        </div>
        <div className="mb5-modal-footer">
          <button className="mb5-btn" onClick={onClose}>Cancelar</button>
          <button className="mb5-btn primary" onClick={handleCreate} disabled={!name.trim() || creating}>{creating ? '⏳ Creando…' : '💾 Crear'}</button>
        </div>
      </div>
    </div>
  )
}

function FromGithubModal({ onClose, onCreated, notify }: { onClose: () => void; onCreated: (a: Agent) => void; notify: any }) {
  const [url, setUrl] = useState('https://github.com/')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [preview, setPreview] = useState<{ name: string; description: string; ok: boolean; msg?: string } | null>(null)

  const handleValidate = async () => {
    if (!url.includes('github.com/')) { notify('err', 'URL debe ser github.com'); return }
    setValidating(true)
    setPreview(null)
    try {
      const m = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
      if (!m) { notify('err', 'URL de GitHub inválida'); setValidating(false); return }
      const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers: { 'Accept': 'application/vnd.github.v3+json' } })
      if (!r.ok) { setPreview({ name: m[2], description: '', ok: false, msg: `GitHub API ${r.status}` }); setValidating(false); return }
      const d = await r.json()
      setPreview({ name: d.name, description: d.description || d.full_name, ok: true })
    } catch (e: any) {
      setPreview({ name: '', description: '', ok: false, msg: e.message })
    } finally {
      setValidating(false)
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const r = await api.agentFromGithub(url)
      if (r.ok) onCreated(r.agent)
      else notify('err', r.error || 'Error')
    } catch (e: any) {
      notify('err', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb5-modal-bg" onClick={onClose}>
      <div className="mb5-modal" onClick={e => e.stopPropagation()}>
        <div className="mb5-modal-header">
          <span className="icon-big">🐙</span>
          <div>
            <h3>Nuevo Agente desde GitHub</h3>
            <div className="subtitle">Descarga y crea un agente desde un repo real</div>
          </div>
          <button className="mb5-iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="mb5-modal-body">
          <div className="mb5-form-row" style={{ gridTemplateColumns: '1fr' }}>
            <label>URL del repositorio</label>
            <input className="mb5-input" placeholder="https://github.com/owner/repo" value={url} onChange={e => setUrl(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="mb5-btn" onClick={handleValidate} disabled={validating}>{validating ? '⏳ Validando…' : '🔍 Validar'}</button>
          </div>
          {preview && (
            <div className={`mb5-preview ${preview.ok ? 'ok' : 'err'}`}>
              {preview.ok ? (
                <>
                  <strong>✓ Repositorio válido</strong>
                  <p><strong>{preview.name}</strong></p>
                  <p style={{ color: 'var(--gray)' }}>{preview.description}</p>
                </>
              ) : (
                <>
                  <strong>⚠ {preview.msg}</strong>
                </>
              )}
            </div>
          )}
        </div>
        <div className="mb5-modal-footer">
          <button className="mb5-btn" onClick={onClose}>Cancelar</button>
          <button className="mb5-btn primary" onClick={handleCreate} disabled={loading || !url.includes('github.com/')}>{loading ? '⏳ Descargando…' : '💾 Crear agente'}</button>
        </div>
      </div>
    </div>
  )
}

// ============ INSPECTOR (derecha) ============
function InspectorTabBar({ tab, onChange }: { tab: InspectorTab; onChange: (t: InspectorTab) => void }) {
  return (
    <div className="mb5-inspector-tabs">
      <button className={tab === 'properties' ? 'active' : ''} onClick={() => onChange('properties')}>PROPS</button>
      <button className={tab === 'help' ? 'active' : ''} onClick={() => onChange('help')}>HELP</button>
      <button className={tab === 'diagnostics' ? 'active' : ''} onClick={() => onChange('diagnostics')}>DIAG</button>
    </div>
  )
}

function InspectorBody({ area, selected, tab }: { area: Area; selected: string | null; tab: InspectorTab }) {
  return (
    <>
      {tab === 'help' && <HelpBody area={area} />}
      {tab === 'diagnostics' && <DiagnosticsBody />}
      {tab === 'properties' && <PropertiesBody area={area} selected={selected} />}
    </>
  )
}

function PropertiesBody({ area, selected }: { area: Area; selected: string | null }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!selected) { setData(null); return }
    const ep = area === 'recursos' ? `${API_BASE}/api/resources/${selected}` : `${API_BASE}/api/v2/agents/${selected}`
    fetch(ep, { headers: { 'X-Role': 'engineer' } })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
  }, [area, selected])

  if (!selected) {
    return <div className="mb5-inspector-body"><p className="hint">Selecciona un elemento de la izquierda para ver sus propiedades.</p></div>
  }
  if (!data) return <div className="mb5-inspector-body"><p className="hint">Cargando...</p></div>

  return (
    <div className="mb5-inspector-body">
      <h4>{data.name || data.id}</h4>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="mb5-prop-row">
          <span className="key">{k}</span>
          <span className="val">{typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80)}</span>
        </div>
      ))}
    </div>
  )
}

function HelpBody({ area }: { area: Area }) {
  const helpTexts: Record<Area, { title: string; items: string[] }> = {
    recursos: {
      title: 'RECURSOS',
      items: [
        'Recursos son piezas reutilizables: APIs, MCPs, GitHub, VPS, etc.',
        'Se configuran UNA vez y los agentes los referencian sin duplicar.',
        'Tipos disponibles: api, mcp, github, vps, huggingface, cloudflare, railway, telegram, gmail, ssh, database, memoria, skill, repositorio, credencial, otro.',
        'Los secretos (api_key, token) se almacenan cifrados.'
      ]
    },
    agentes: {
      title: 'AGENTES',
      items: [
        'Cada agente es un ejecutor con modelo, entradas y salidas.',
        'Entradas: tipos de input que acepta (chat, router, github, etc.).',
        'Salidas: destinos donde escribe resultados (vps, github, telegram, etc.).',
        'Recursos: de la biblioteca, NO se duplica config.',
        'Para crear uno nuevo: pulsa + Nuevo o 🐙 desde GitHub.'
      ]
    },
    router: {
      title: 'ROUTER',
      items: [
        'El Router es el orquestador global.',
        'Entradas: tipos de input que el Router acepta.',
        'Salidas: destinos posibles (chat, github, vps, huggingface, etc.).',
        'Orden: secuencia de ejecución (con ↑↓).',
        'Prioridades: orden numérico (menor = más prioritario).',
        'Fallback: si el destino primario falla, salta a este.',
        'Consensus: N modelos responden, se elige el mejor.',
        'Recovery: reintentos, backoff, circuit breaker.',
        'Chat: M3 responde en español usando NVIDIA NIM.'
      ]
    }
  }
  const h = helpTexts[area]
  return (
    <div className="mb5-inspector-body">
      <h4>{h.title}</h4>
      {h.items.map((t, i) => <p key={i} className="hint">• {t}</p>)}
    </div>
  )
}

function DiagnosticsBody() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    const t = setInterval(() => {
      Promise.all([
        client.providers().then((d: any) => d).catch(() => null),
        client.watchdog().then((d: any) => d).catch(() => null),
        client.circuitBreakers().then((d: any) => d).catch(() => null),
      ]).then(([p, w, c]) => setData({ providers: p?.count || 0, heartbeats: w?.heartbeat_count || 0, breakers: Object.keys(c?.breakers || {}).length, uptime: w?.uptime_s || 0 }))
    }, 5000)
    return () => clearInterval(t)
  }, [])
  if (!data) return <div className="mb5-inspector-body"><p>Cargando...</p></div>
  return (
    <div className="mb5-inspector-body">
      <h4>DIAGNÓSTICO</h4>
      <div className="mb5-prop-row"><span className="key">Providers</span><span className="val">{data.providers}</span></div>
      <div className="mb5-prop-row"><span className="key">Heartbeats</span><span className="val">{data.heartbeats}</span></div>
      <div className="mb5-prop-row"><span className="key">Uptime (s)</span><span className="val">{data.uptime}</span></div>
      <div className="mb5-prop-row"><span className="key">Breakers</span><span className="val">{data.breakers}</span></div>
    </div>
  )
}

export default App

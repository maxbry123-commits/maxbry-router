import { useState, useEffect } from 'react'
import { client } from './api'

export function ModulesPanel({ isEngineer, notify }: { isEngineer: boolean, notify: (k: 'ok'|'err'|'info', t: string) => void }) {
  // Cargar snapshot de forma sincrona desde la ventana (inyectado en build)
  const initialSnapshot: any = (typeof window !== 'undefined' && (window as any).__SNAPSHOT__) || { status: 'unavailable' }
  const debugInfo = `isEngineer=${isEngineer} snap.status=${initialSnapshot?.status} providers=${initialSnapshot?.providers?.providers?.length || 0}`
  const [moduleOpen, setModuleOpen] = useState<string>('provider')
  const [providers, setProviders] = useState<any[]>([])
  const [healthMon, setHealthMon] = useState<any>(null)
  const [wd, setWd] = useState<any>(null)
  const [breakers, setBreakers] = useState<Record<string, any>>({})
  const [market, setMarket] = useState<any[]>([])
  const [customPanels, setCustomPanels] = useState<any[]>([])
  const [builderTab, setBuilderTab] = useState<'agent'|'skill'|'workflow'>('agent')
  const [builderAgents, setBuilderAgents] = useState<any[]>([])
  const [newAgent, setNewAgent] = useState({ name: '', role: 'executor', provider: 'litellm' })
  const [newSkill, setNewSkill] = useState({ name: '', version: '1.0.0', category: 'intelligence' })
  const [schemas, setSchemas] = useState<Record<string, any>>({})
  const [newSchema, setNewSchema] = useState({ name: '', fields: 'campo1:string, campo2:number' })
  const [workflows, setWorkflows] = useState<any[]>([])
  const [wfDraft, setWfDraft] = useState<any>({ id: '', nodes: [], edges: [] })
  const [memList, setMemList] = useState<any[]>([])
  const [memSelected, setMemSelected] = useState<string>('')
  const [memContent, setMemContent] = useState<string>('')
  const [, setSnapshot] = useState<any>(initialSnapshot)
  void setSnapshot

  

  useEffect(() => {
    // Cargar snapshot desde window.__SNAPSHOT__ (inyectado en build) - SIEMPRE al montar
    const s: any = (typeof window !== 'undefined' && (window as any).__SNAPSHOT__) || { status: 'unavailable' }
    if (s.providers?.providers) setProviders(s.providers.providers)
    if (s.health?.services) setHealthMon(s.health)
    if (s.watchdog?.heartbeat_count !== undefined) setWd(s.watchdog)
    if (s.breakers?.breakers) setBreakers(s.breakers.breakers)
    if (s.bridge) {
      const items = [...(s.bridge.skills||[]), ...(s.bridge.docs||[]), ...(s.bridge.dsl||[]), ...(s.bridge.contracts||[])]
      setMarket(items)
    }
    if (s.customPanels?.panels) setCustomPanels(s.customPanels.panels)
    if (s.agents?.agents) setBuilderAgents(s.agents.agents)
    if (s.schemas?.schemas) setSchemas(s.schemas.schemas)
    if (s.workflows?.workflows) setWorkflows(s.workflows.workflows)
    if (s.memory?.items) setMemList(s.memory.items)
  }, [])

  useEffect(() => {
    if (!isEngineer) return
    // Live polling
    const tryLive = async () => {
      try { const d = await client.providers(); if (d?.providers?.length) setProviders(d.providers) } catch (e) {}
      try { const d = await client.healthMonitor(); if (d?.services) setHealthMon(d) } catch (e) {}
      try { const d = await client.watchdog(); if (d?.heartbeat_count !== undefined) setWd(d) } catch (e) {}
      try { const d = await client.circuitBreakers(); if (d?.breakers) setBreakers(d.breakers) } catch (e) {}
      try { const d = await client.bridgeRegistry(); if (d) setMarket([...(d.skills||[]), ...(d.docs||[]), ...(d.dsl||[]), ...(d.contracts||[])]) } catch (e) {}
    }
    tryLive()
    const t = setInterval(tryLive, 10000)
    return () => clearInterval(t)
  }, [isEngineer])

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
      <div className="mb5-mod-body" data-debug={debugInfo}>
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
                <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>P{p.priority} · {p.fallback} · {p.models?.length || 0} modelos · {p.cost_1k > 0 ? '$' + p.cost_1k + '/1k' : 'gratis'} · retry {p.retry} · timeout {p.timeout_s}s</div>
                <div style={{ color: 'var(--gray)', fontSize: 9, marginTop: 2, wordBreak: 'break-all' }}>{p.endpoint}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {p.state === 'online' ? (
                    <button className="mb5-btn danger" style={{ fontSize: 9, padding: '2px 8px' }} onClick={async () => { await client.disableProvider(p.id); client.providers().then(d => { if (d?.providers?.length) setProviders(d.providers) }).catch(() => {}) }}>⏸ Desactivar</button>
                  ) : (
                    <button className="mb5-btn primary" style={{ fontSize: 9, padding: '2px 8px' }} onClick={async () => { await client.enableProvider(p.id); client.providers().then(d => { if (d?.providers?.length) setProviders(d.providers) }).catch(() => {}) }}>▶ Activar</button>
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
              <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}><div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Heartbeats</div><div style={{ color: 'var(--accent)', fontSize: 16, fontFamily: 'var(--mono)', fontWeight: 700 }}>{wd?.heartbeat_count || 0}</div></div>
              <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}><div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Auto-Recovery</div><div style={{ color: 'var(--green)', fontSize: 16, fontFamily: 'var(--mono)', fontWeight: 700 }}>{wd?.auto_recoveries || 0}</div></div>
              <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}><div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Uptime (s)</div><div style={{ color: 'var(--blue)', fontSize: 14, fontFamily: 'var(--mono)' }}>{wd?.uptime_s || 0}</div></div>
              <div style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 3 }}><div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Status</div><div style={{ color: 'var(--green)', fontSize: 14, fontFamily: 'var(--mono)' }}>{wd?.status || '—'}</div></div>
            </div>
            {wd?.heartbeats?.slice(-5).reverse().map((h: any, i: number) => (
              <div key={i} style={{ fontSize: 9, color: 'var(--gray)', fontFamily: 'var(--mono)', padding: 3, borderBottom: '1px solid var(--border)' }}>{h.ts} · {h.ok ? '✓' : '✗'}</div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--white)', fontWeight: 700 }}>{b.name.toUpperCase()}</span><span style={{ color, fontWeight: 700 }}>{b.state.toUpperCase()}</span></div>
                  <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Failures: {b.failures} · Last: {b.last_failure || 'never'}</div>
                  <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }} onClick={async () => { await client.circuitReset(b.name); client.circuitBreakers().then(d => { if (d?.breakers) setBreakers(d.breakers) }).catch(() => {}) }}>↻ Reset</button>
                </div>
              )
            })}
          </div>
        )}

        {moduleOpen === 'market' && (
          <div>
            <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Marketplace (live bridge)</h4>
            <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Auto-refresh: 10s · {market.length} items</div>
            <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginBottom: 8 }} onClick={async () => { await client.bridgeSync(); client.bridgeRegistry().then(d => { if (d) setMarket([...(d.skills||[]), ...(d.docs||[]), ...(d.dsl||[]), ...(d.contracts||[])]) }).catch(() => {}); notify('ok', 'Sync OK') }}>↻ Sincronizar desde GitHub</button>
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
            <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Custom Panels</h4>
            <div style={{ fontSize: 9, color: 'var(--gray-2)', fontFamily: 'var(--mono)', marginBottom: 8 }}>/opt/nct/custom-panels · {customPanels.length} paneles</div>
            {customPanels.map((p: any) => (
              <div key={p.name} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 8, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--white)' }}>{p.icon} {p.name}</span><span className="mb5-pill green" style={{ fontSize: 9 }}>{p.enabled ? 'on' : 'off'}</span></div>
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
                <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newAgent.role} onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}><option value="executor">executor</option><option value="planner">planner</option><option value="reviewer">reviewer</option></select>
                <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newAgent.provider} onChange={e => setNewAgent({ ...newAgent, provider: e.target.value })}>{providers.filter(p => p.state === 'online').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={async () => { if (!newAgent.name) { notify('err', 'Falta nombre'); return } const r = await client.builderAgent(newAgent); if (r.ok) { notify('ok', 'Agente ' + r.agent_id + ' creado'); fetch('/api/agents', { headers: { 'X-Role': 'engineer' }}).then(r => r.json()).then(d => { if (d?.agents) setBuilderAgents(d.agents) }).catch(() => {}); setNewAgent({ ...newAgent, name: '' }) } }}>+ Crear agente</button>
              </div>
            )}
            {builderTab === 'skill' && (
              <div>
                <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} placeholder="nombre" value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })} />
                <select className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} value={newSkill.category} onChange={e => setNewSkill({ ...newSkill, category: e.target.value })}>{['intelligence','infra','knowledge','agents','security','productivity','ui'].map(c => <option key={c} value={c}>{c}</option>)}</select>
                <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={async () => { if (!newSkill.name) { notify('err', 'Falta nombre'); return } const r = await client.builderSkill(newSkill); if (r.ok) { notify('ok', 'Skill ' + r.skill_id + ' creado'); setNewSkill({ ...newSkill, name: '' }) } }}>+ Crear skill (manifest)</button>
              </div>
            )}
            {builderTab === 'workflow' && (
              <div>
                <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10 }} placeholder="workflow id" value={wfDraft.id} onChange={e => setWfDraft({ ...wfDraft, id: e.target.value })} />
                <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Nodos: {wfDraft.nodes.length} · Edges: {wfDraft.edges.length}</div>
                <button className="mb5-btn" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={() => { const next = wfDraft.nodes.length + 1; const newNode = { id: 'n' + next, type: 'agent', label: 'n' + next, x: 50 + next * 100, y: 50 }; setWfDraft({ ...wfDraft, nodes: [...wfDraft.nodes, newNode] }) }}>+ Nodo</button>
                <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10 }} onClick={() => { if (!wfDraft.id) { notify('err', 'Falta id'); return } if (wfDraft.nodes.length < 1) { notify('err', 'Añade al menos 1 nodo'); return } if (wfDraft.nodes.length < 2) { notify('err', 'Necesitas 2 nodos'); return } const a = wfDraft.nodes[wfDraft.nodes.length-2]; const b = wfDraft.nodes[wfDraft.nodes.length-1]; setWfDraft({ ...wfDraft, edges: [...wfDraft.edges, { from: a.id, to: b.id }] }); notify('ok', 'Edge añadido') }}>↔ Conectar últimos 2</button>
                <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginTop: 4 }} onClick={async () => { const r = await client.saveWorkflow(wfDraft); if (r.ok) { notify('ok', 'Workflow ' + r.id + ' guardado'); client.workflows().then(d => { if (d?.workflows) setWorkflows(d.workflows) }).catch(() => {}); setWfDraft({ id: '', nodes: [], edges: [] }) } }}>💾 Guardar</button>
              </div>
            )}
            {builderAgents.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Agentes creados ({builderAgents.length})</div>
                {builderAgents.map((a: any) => (<div key={a.id} style={{ background: 'var(--panel-2)', padding: 4, borderRadius: 3, fontSize: 9, fontFamily: 'var(--mono)', marginBottom: 3 }}>{a.id} · {a.role} · {a.provider}</div>))}
              </div>
            )}
          </div>
        )}

        {moduleOpen === 'schema' && (
          <div>
            <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Schema Builder (live)</h4>
            <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontSize: 10, fontFamily: 'var(--mono)' }} placeholder="schema name" value={newSchema.name} onChange={e => setNewSchema({ ...newSchema, name: e.target.value })} />
            <input className="mb5-input" style={{ width: '100%', marginBottom: 4, fontSize: 10, fontFamily: 'var(--mono)' }} placeholder="campos: a:string, b:number" value={newSchema.fields} onChange={e => setNewSchema({ ...newSchema, fields: e.target.value })} />
            <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={async () => { if (!newSchema.name) { notify('err', 'Falta nombre'); return } const fields = newSchema.fields.split(',').map(f => { const parts = f.trim().split(':'); return { name: (parts[0]||'').trim(), kind: (parts[1]||'string').trim(), required: false } }).filter(f => f.name); const r = await client.saveSchema(newSchema.name, { type: newSchema.name, fields }); if (r.ok) { notify('ok', 'Schema ' + newSchema.name + ' guardado'); client.schemas().then(d => { if (d?.schemas) setSchemas(d.schemas) }).catch(() => {}); setNewSchema({ name: '', fields: 'campo:string' }) } }}>+ Guardar schema</button>
            {Object.entries(schemas).map(([k, v]: any) => (
              <div key={k} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 3, padding: 6, marginBottom: 4, fontSize: 9, fontFamily: 'var(--mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--white)' }}>{k}</span><button className="mb5-btn danger" style={{ fontSize: 8, padding: '1px 6px' }} onClick={async () => { await fetch('/api/schemas/' + k, { method: 'DELETE', headers: { 'X-Role': 'engineer' }}); client.schemas().then(d => { if (d?.schemas) setSchemas(d.schemas) }).catch(() => {}); notify('ok', 'Eliminado') }}>🗑</button></div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--white)', fontWeight: 700 }}>{w.id}</span><button className="mb5-btn danger" style={{ fontSize: 8, padding: '1px 6px' }} onClick={async () => { await fetch('/api/workflows/' + w.id, { method: 'DELETE', headers: { 'X-Role': 'engineer' }}); client.workflows().then(d => { if (d?.workflows) setWorkflows(d.workflows) }).catch(() => {}) }}>🗑</button></div>
                <div style={{ color: 'var(--gray-2)', fontSize: 9 }}>Nodos: {w.nodes.length} · Edges: {w.edges?.length || 0} · {w.ts}</div>
                <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }} onClick={() => { setWfDraft(w); setModuleOpen('builder'); notify('info', 'Cargado en builder') }}>↻ Cargar</button>
              </div>
            ))}
          </div>
        )}

        {moduleOpen === 'memory' && (
          <div>
            <h4 style={{ color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, margin: '0 0 8px' }}>Memory Manager (live)</h4>
            <button className="mb5-btn" style={{ fontSize: 9, padding: '2px 8px', marginBottom: 8 }} onClick={() => { fetch('/api/memory/listar', { headers: { 'X-Role': 'engineer' }}).then(r => r.json()).then(d => { if (d?.items) setMemList(d.items) }).catch(() => {}) }}>↻ Refrescar</button>
            {memList.map((m: any) => (
              <div key={m.path} style={{ background: memSelected === m.path ? 'var(--panel-2)' : 'transparent', border: '1px solid ' + (memSelected === m.path ? 'var(--accent)' : 'var(--border)'), borderRadius: 3, padding: 6, marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer' }} onClick={async () => { setMemSelected(m.path); const r = await client.memoryRead(m.path); setMemContent(r.content) }}>
                <span style={{ color: 'var(--white)' }}>{m.path}</span><span style={{ color: 'var(--gray-2)', fontSize: 9, marginLeft: 6 }}>{m.size}b</span>
              </div>
            ))}
            {memSelected && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, color: 'var(--gray-2)', marginBottom: 4 }}>Editando: {memSelected}</div>
                <textarea className="mb5-input" style={{ width: '100%', height: 80, fontFamily: 'var(--mono)', fontSize: 10 }} value={memContent} onChange={e => setMemContent(e.target.value)} />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button className="mb5-btn primary" style={{ flex: 1, fontSize: 9 }} onClick={async () => { const r = await client.memorySave(memSelected, memContent); if (r.ok) { notify('ok', 'Guardado'); fetch('/api/memory/listar', { headers: { 'X-Role': 'engineer' }}).then(r => r.json()).then(d => { if (d?.items) setMemList(d.items) }).catch(() => {}) } }}>💾 Guardar</button>
                  <button className="mb5-btn danger" style={{ flex: 1, fontSize: 9 }} onClick={async () => { await fetch('/api/memory/eliminar?path=' + encodeURIComponent(memSelected), { method: 'DELETE', headers: { 'X-Role': 'engineer' }}); notify('ok', 'Eliminado'); setMemSelected(''); setMemContent(''); fetch('/api/memory/listar', { headers: { 'X-Role': 'engineer' }}).then(r => r.json()).then(d => { if (d?.items) setMemList(d.items) }).catch(() => {}) }}>🗑 Eliminar</button>
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
            <button className="mb5-btn primary" style={{ width: '100%', fontSize: 10, marginBottom: 4 }} onClick={async () => { const r = await client.recoverySimulate(); notify('ok', 'Recovery simulado: ' + r.auto_recoveries); client.watchdog().then(d => { if (d?.heartbeat_count !== undefined) setWd(d) }).catch(() => {}) }}>▶ Simular Recovery</button>
            <div style={{ fontSize: 9, color: 'var(--gray-2)', marginTop: 8 }}>Circuit Breakers:</div>
            {Object.values(breakers).map((b: any) => (
              <button key={b.name} className="mb5-btn" style={{ width: '100%', fontSize: 9, marginTop: 3 }} onClick={async () => { await client.circuitReset(b.name); client.circuitBreakers().then(d => { if (d?.breakers) setBreakers(d.breakers) }).catch(() => {}) }}>↻ Reset {b.name}</button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

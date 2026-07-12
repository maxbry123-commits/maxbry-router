import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fetchLocal(path) {
  try {
    const r = execSync(`sshpass -p '770361793Max$' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@95.111.232.89 'curl -s -H "X-Role: engineer" http://127.0.0.1:8000${path}'`, { encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(r);
  } catch (e) {
    return null;
  }
}

const snapshot = {
  generated: new Date().toISOString(),
  status: 'unavailable',
  providers: null,
  health: null,
  watchdog: null,
  breakers: null,
  bridge: null,
  customPanels: null,
  workflows: null,
  agents: null,
  schemas: null,
  memory: null
};

console.log('[snapshot] Consultando VPS via SSH...');
const endpoints = {
  providers: '/api/providers',
  health: '/api/health/monitor',
  watchdog: '/api/watchdog',
  breakers: '/api/circuit-breakers',
  bridge: '/api/bridge/registry',
  customPanels: '/api/custom-panels',
  workflows: '/api/workflows',
  agents: '/api/agents',
  schemas: '/api/schemas',
  memory: '/api/memory/listar'
};

for (const [k, p] of Object.entries(endpoints)) {
  const data = fetchLocal(p);
  if (data) {
    snapshot[k] = data;
    console.log(`  [snapshot] ${k}: OK`);
  } else {
    console.log(`  [snapshot] ${k}: fail`);
  }
}

snapshot.status = snapshot.providers ? 'available' : 'unavailable';
console.log(`[snapshot] status: ${snapshot.status}`);

const outDir = path.join(__dirname, 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
console.log('[snapshot] escrito en public/snapshot.json');

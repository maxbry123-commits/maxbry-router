import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function injectSnapshot() {
  return {
    name: 'inject-snapshot',
    transformIndexHtml(html: string) {
      const snapPath = path.join(__dirname, 'public', 'snapshot.json')
      if (fs.existsSync(snapPath)) {
        const snap = fs.readFileSync(snapPath, 'utf-8')
        return html.replace(
          '</head>',
          `<script>window.__SNAPSHOT__ = ${snap};</script></head>`
        )
      }
      return html
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [injectSnapshot(), react()],
})

import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await ctx.new_page()

        await page.goto('http://localhost:5173', wait_until='networkidle')
        await page.wait_for_timeout(500)
        # Login como ingeniero
        await page.click('text=🔐 Ingeniero (acceso total)')
        await page.wait_for_timeout(300)
        await page.fill('input[placeholder*="max@maxbry"]', 'max@maxbry-router.dev')
        await page.fill('input[type=password]', '770361793Max$')
        await page.click('text=🔓 Desbloquear')
        await page.wait_for_timeout(800)

        # 1. AI panel visible
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/20-ai-default.png', full_page=False)
        print("20-ai-default OK")

        # 2. Click "+ Conectar GitHub" quick action
        await page.click('text=+ Conectar GitHub')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/21-ai-wizard-github.png', full_page=False)
        print("21-ai-wizard-github OK")

        # 3. NL → config: "Claude Code que reciba del chat y guarde en GitHub"
        await page.fill('input[placeholder*="Pregunta"]', 'Claude Code que reciba del chat y guarde en GitHub')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/22-ai-nl-parse.png', full_page=False)
        print("22-ai-nl-parse OK")

        # 4. Tab Diagnóstico
        await page.click('text=Diagnóstico')
        await page.wait_for_timeout(200)
        await page.fill('input[placeholder*="Pregunta"]', 'Connection refused on VPS 7001')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/23-ai-diagnostics.png', full_page=False)
        print("23-ai-diagnostics OK")

        # 5. Tab Arquitectura — ver score
        await page.click('text=Arquitectura')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/24-ai-architecture.png', full_page=False)
        print("24-ai-architecture OK")

        # 6. Tab Optimización
        await page.click('text=Optimización')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/25-ai-optimization.png', full_page=False)
        print("25-ai-optimization OK")

        # 7. Cerrar AI panel
        await page.click('button[title="Cerrar"]')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/26-ai-collapsed.png', full_page=False)
        print("26-ai-collapsed OK")

        await browser.close()

asyncio.run(main())

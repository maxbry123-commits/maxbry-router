import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await ctx.new_page()

        await page.goto('http://localhost:5173', wait_until='networkidle')
        await page.wait_for_timeout(800)
        # Login como ingeniero
        await page.click('text=🔐 Ingeniero (acceso total)')
        await page.wait_for_timeout(300)
        await page.fill('input[placeholder*="max@maxbry"]', 'max@maxbry-router.dev')
        await page.fill('input[type=password]', '770361793Max$')
        await page.click('text=🔓 Desbloquear')
        await page.wait_for_timeout(800)

        # 1. Estado inicial — mini chat visible
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/30-mini-default.png', full_page=False)
        print("30-mini-default OK")

        # 2. NL parsing: VPS config
        await page.locator('input[placeholder*="Describe"]').fill('VPS 95.111.232.89 puerto 22 usuario root')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/31-mini-vps-parse.png', full_page=False)
        print("31-mini-vps-parse OK")

        # 3. NL parsing: GitHub
        await page.locator('input[placeholder*="Describe"]').fill('Conecta GitHub con token ghp_A7XB...REDACTED... y repo maxbry123-commits/maxbry-router')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/32-mini-github-parse.png', full_page=False)
        print("32-mini-github-parse OK")

        # 4. NL parsing: Claude + fallback
        await page.locator('input[placeholder*="Describe"]').fill('Quiero modelo claude-sonnet-4.5 con fallback mimo')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/33-mini-claude-parse.png', full_page=False)
        print("33-mini-claude-parse OK")

        # 5. Click "Aplicar al agente seleccionado"
        apply_btn = page.locator('button:has-text("Aplicar al agente seleccionado")').last
        if await apply_btn.count() > 0:
            await apply_btn.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/34-mini-applied.png', full_page=False)
            print("34-mini-applied OK")

        # 6. Verificar que el modelo se aplicó — ir al inspector
        await page.click('text=Claude Code')
        await page.wait_for_timeout(300)
        await page.click('text=IA')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/35-mini-verify-applied.png', full_page=False)
        print("35-mini-verify-applied OK")

        # 7. Minimizar mini chat
        await page.click('button[title="Minimizar"]')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/36-mini-minimized.png', full_page=False)
        print("36-mini-minimized OK")

        # 8. NL sin detección
        await page.click('button[title="Expandir"]')
        await page.wait_for_timeout(200)
        await page.locator('input[placeholder*="Describe"]').fill('hola como estas')
        await page.click('button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/37-mini-no-detect.png', full_page=False)
        print("37-mini-no-detect OK")

        await browser.close()

asyncio.run(main())

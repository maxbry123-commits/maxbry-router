import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await ctx.new_page()

        await page.goto('http://localhost:5173', wait_until='networkidle')
        await page.wait_for_timeout(800)
        await page.click('text=🔐 Ingeniero (acceso total)')
        await page.wait_for_timeout(300)
        await page.fill('input[placeholder*="max@maxbry"]', 'max@maxbry-router.dev')
        await page.fill('input[type=password]', '770361793Max$')
        await page.click('text=🔓 Desbloquear')
        await page.wait_for_timeout(1000)

        # Solo verificar el mini chat presente y los parses
        await page.locator('input[placeholder*="Describe"]').fill('VPS 95.111.232.89 puerto 22 usuario root')
        await page.click('.mb5-mini-input button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/final-1-vps.png')
        print("final-1-vps OK")

        # Verificar que apareció un autofill
        autofill_count = await page.locator('text=aplicar al agente').count()
        print(f"Botones aplicar visibles: {autofill_count}")

        # Verificar campos detectados
        ip_visible = await page.locator('text=95.111.232.89').count()
        port_visible = await page.locator('text=/puerto|port/').count()
        user_visible = await page.locator('text=root').count()
        print(f"IP={ip_visible}, port={port_visible}, user={user_visible}")

        # Claude con fallback
        await page.locator('input[placeholder*="Describe"]').fill('Quiero modelo claude-sonnet-4.5 con fallback mimo')
        await page.click('.mb5-mini-input button:has-text("▶")')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/final-2-claude.png')
        print("final-2-claude OK")

        # Click aplicar
        await page.locator('button:has-text("Aplicar al agente seleccionado")').last.click()
        await page.wait_for_timeout(800)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/final-3-applied.png')
        print("final-3-applied OK")

        # Verificar toast
        toast = await page.locator('.mb5-toast').count()
        print(f"Toasts: {toast}")

        await browser.close()

asyncio.run(main())

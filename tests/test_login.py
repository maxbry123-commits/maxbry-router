import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await ctx.new_page()

        # 1. Pantalla de login
        await page.goto('http://localhost:5173', wait_until='networkidle')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/10-login.png', full_page=False)
        print("10-login OK")

        # 2. Click "Ingeniero"
        await page.click('text=🔐 Ingeniero (acceso total)')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/11-engineer-form.png', full_page=False)
        print("11-engineer-form OK")

        # 3. Rellenar email y clave
        await page.fill('input[placeholder*="max@maxbry"]', 'max@maxbry-router.dev')
        await page.fill('input[type=password]', '770361793Max$')
        await page.wait_for_timeout(200)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/12-form-filled.png', full_page=False)
        print("12-form-filled OK")

        # 4. Click Desbloquear
        await page.click('text=🔓 Desbloquear')
        await page.wait_for_timeout(800)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/13-engineer-unlocked.png', full_page=False)
        print("13-engineer-unlocked OK")

        # 5. Click en credenciales del panel recursos
        await page.click('text=GitHub PAT')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/14-cred-encrypted.png', full_page=False)
        print("14-cred-encrypted OK")

        # 6. Click Descifrar
        await page.click('text=🔓 Descifrar con mi clave maestra')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/15-cred-decrypted.png', full_page=False)
        print("15-cred-decrypted OK")

        # 7. Click en una agente
        await page.click('text=Claude Code')
        await page.wait_for_timeout(300)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/16-agent-view.png', full_page=False)
        print("16-agent-view OK")

        # 8. Cambiar tab Entradas
        try:
            await page.click('text=Entradas', timeout=2000)
            await page.wait_for_timeout(300)
            await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/17-entradas.png', full_page=False)
            print("17-entradas OK")
        except Exception as e:
            print(f"17 fail: {e}")

        # 9. Logout y probar como guest
        await page.click('text=⏻')
        await page.wait_for_timeout(300)
        await page.click('text=👤 Usuario (solo ejecución)')
        await page.wait_for_timeout(300)
        await page.click('text=Entrar como Usuario')
        await page.wait_for_timeout(500)
        await page.screenshot(path='/workspace/MAXBRY-ROUTER/screenshots/18-guest-mode.png', full_page=False)
        print("18-guest-mode OK")

        # 10. Verificar que NO aparece "Credenciales" en guest
        cred_visible = await page.locator('text=Credenciales').count()
        print(f"Credenciales visibles para guest: {cred_visible} (esperado 0)")

        await browser.close()

asyncio.run(main())

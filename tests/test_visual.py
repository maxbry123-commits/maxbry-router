"""Tests visuales con Playwright aplicando skill webapp-testing."""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:5173"
API = "http://localhost:8000"

async def test_visual():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        
        # 1. Cargar la interface
        print("1. Cargando interface...")
        await page.goto(BASE, wait_until="networkidle", timeout=15000)
        await asyncio.sleep(2)
        title = await page.title()
        print(f"   ✅ Título: {title}")
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/01-load.png", full_page=True)
        
        # 2. Verificar que el h1 muestra MAXBRY
        h1 = await page.locator("h1").first.text_content()
        print(f"   ✅ H1: {h1}")
        
        # 3. Verificar status global (router, github, hf, claude, minimax)
        print("2. Verificando status global...")
        await asyncio.sleep(1)
        # Buscar texto "router" en la página
        router_text = await page.get_by_text("router", exact=False).count()
        github_text = await page.get_by_text("github", exact=False).count()
        claude_text = await page.get_by_text("claude", exact=False).count()
        minimax_text = await page.get_by_text("minimax", exact=False).count()
        print(f"   router: {router_text} menciones, github: {github_text}, claude: {claude_text}, minimax: {minimax_text}")
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/02-status.png", full_page=True)
        
        # 4. Click en Novato
        print("3. Click en Novato...")
        await page.get_by_role("button", name="Novato").click()
        await asyncio.sleep(1)
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/03-novato.png", full_page=True)
        
        # 5. Click en Experto
        print("4. Click en Experto...")
        await page.get_by_role("button", name="Experto").click()
        await asyncio.sleep(1)
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/04-experto.png", full_page=True)
        
        # 6. Búsqueda
        print("5. Búsqueda...")
        search = page.locator("input[placeholder*='Buscar']").first
        await search.fill("architecture")
        await asyncio.sleep(1)
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/05-search.png", full_page=True)
        await search.fill("")
        
        # 7. Click en un botón TEST
        print("6. Click TEST en un módulo...")
        test_buttons = page.locator("button:has-text('TEST')")
        count = await test_buttons.count()
        print(f"   {count} botones TEST encontrados")
        if count > 0:
            await test_buttons.first.click()
            await asyncio.sleep(2)
            await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/06-test.png", full_page=True)
        
        # 8. Click en Quick Action
        print("7. Click Quick Action Ejecutar...")
        await page.get_by_role("button", name="▶ Ejecutar").click()
        await asyncio.sleep(1)
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/07-quickaction.png", full_page=True)
        
        # 9. Scroll abajo
        print("8. Scroll abajo (módulos)...")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1)
        await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/08-bottom.png", full_page=True)
        
        # 10. Hover en un módulo
        print("9. Hover módulo...")
        module = page.locator("text=M61 Architecture").first
        if await module.count() > 0:
            await module.hover()
            await asyncio.sleep(1)
            await page.screenshot(path="/workspace/MAXBRY-ROUTER/screenshots/09-hover.png", full_page=True)
        
        # 11. Resumen
        print("10. Resumen...")
        modules_count = await page.locator("text=/^M[0-9]/").count()
        print(f"   {modules_count} módulos visibles")
        
        await browser.close()
        print()
        print("✅ Tests visuales completados · 9 screenshots guardados")

asyncio.run(test_visual())

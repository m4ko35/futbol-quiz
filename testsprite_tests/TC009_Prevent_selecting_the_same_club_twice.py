import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Scroll down to reveal the club selection controls on the Futbol Quiz page so the two club selectors become visible.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down to reveal the club selection controls so the two side selectors become visible.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down the Futbol Quiz page until the two club selection controls are visible so they can be inspected.
        await page.mouse.wheel(0, 300)
        
        # -> Click the first club input labeled 'Birinci kulüp' (placeholder: 'Lig seçin ya da yazın…') to open its suggestions.
        # Lig seçin ya da yazın… text field
        elem = page.get_by_label('Birinci kulüp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'Süper Lig' option from the 'Birinci kulüp' dropdown to proceed toward choosing a club for the first side.
        # Süper Lig Türkiye 41 › option
        elem = page.get_by_role('option', name='Süper Lig Türkiye 41', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'İkinci kulüp' input and select 'Adana Demirspor' (the same club chosen for the first side).
        # Lig seçin ya da yazın… text field
        elem = page.get_by_label('İkinci kulüp', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'Süper Lig' league from the 'İkinci kulüp' dropdown to load its club list.
        # Süper Lig Türkiye 41 › option
        elem = page.get_by_role('option', name='Süper Lig Türkiye 41', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> No same-club validation error appeared after selecting Adana Demirspor for both sides.
        await page.locator("xpath=/html/body/main/div/div[1]/div[2]/div/div/div[2]/ul/li[1]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: failed
        # Assert: Expected the second club list to show 'Adana Demirspor' as a visible option (confirming the same club was selected).
        await expect(page.locator("xpath=/html/body/main/div/div[1]/div[2]/div/div/div[2]/ul/li[1]").nth(0)).to_be_visible(timeout=15000), "Expected the second club list to show 'Adana Demirspor' as a visible option (confirming the same club was selected)."
        # Assert-outcome: failed
        # Assert: Expected the page to display a same-club validation message (for example containing 'aynı kulüp').
        await expect(page.locator("xpath=/html/body/main/div/div[1]/div[2]/div/div/div[2]/ul").nth(0)).to_contain_text("ayn\u0131 kul\u00fcp", timeout=15000), "Expected the page to display a same-club validation message (for example containing 'ayn\u0131 kul\u00fcp')."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
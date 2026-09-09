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
        
        # -> Open the 'Hangisi Daha' comparison page (the comparison / hangisi-daha page).
        await page.goto("http://localhost:3000/hangisi-daha")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Scroll down to reveal the two player cards on the 'Hangisi Daha' comparison page so one can be selected.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down to reveal the two player cards on the 'Hangisi Daha' comparison page so one can be selected.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down the 'Hangisi Daha' page to reveal the two player choice cards so one can be selected.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll the 'Hangisi Daha' page down to reveal the two player choice cards so one can be selected.
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'Başla' button to start a comparison round.
        # Başla → button
        elem = page.get_by_role('button', name='Başla', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Lionel Messi' player card to make a guess for this round.
        # Lionel Messi Barcelona · Inter Miami · Paris... button
        elem = page.get_by_role('button', name='Lionel Messi Barcelona · Inter Miami · Paris Saint-Germain ?', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Devam' button to advance to the next round.
        # Devam button
        elem = page.get_by_role('button', name='Devam', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The next round loaded and shows the Cristiano Ronaldo choice button.
        # Assert-outcome: passed
        # Assert: The Cristiano Ronaldo choice button is visible for the new round.
        await expect(page.locator("xpath=/html/body/main/div/ul/li[2]/button").nth(0)).to_contain_text("Cristiano Ronaldo", timeout=15000), "The Cristiano Ronaldo choice button is visible for the new round."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
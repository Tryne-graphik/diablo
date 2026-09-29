from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    # the avatar/user menu near top right
    page.locator('img[src*="discordapp.com"]').first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_profile_menu.png"), full_page=False)

    links = page.eval_on_selector_all("a", "els => els.map(e => ({href: e.getAttribute('href'), text: e.innerText.trim()})).filter(x => x.text)")
    for l in links[:60]:
        print(l)

    context.close()

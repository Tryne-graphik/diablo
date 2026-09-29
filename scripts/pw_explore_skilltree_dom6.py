from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds/new", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    page.click("text=Barbarian")
    page.wait_for_timeout(500)
    page.click("text=Rogue")
    page.wait_for_timeout(1500)
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(5000)

    print("canvas count:", page.locator("canvas").count())
    print("svg count:", page.locator("svg").count())

    # find svgs with viewBox that looks like a big tree (large width/height attr) among all svgs
    svgs = page.evaluate("""
    () => [...document.querySelectorAll('svg')].map(s => ({
        w: s.getAttribute('width'), h: s.getAttribute('height'), vb: s.getAttribute('viewBox'), cls: s.getAttribute('class')
    }))
    """)
    # print only ones with large dims
    big = [s for s in svgs if (s['w'] and s['w'] not in ('11','16','18','20','24')) or (s['vb'] and '24 24' not in (s['vb'] or ''))]
    print("big svgs:", len(big))
    for s in big[:20]:
        print(s)

    context.close()

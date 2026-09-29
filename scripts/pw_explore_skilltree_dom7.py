from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"

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
    page.wait_for_timeout(3000)

    print("iframe count:", page.locator("iframe").count())
    srcs = page.eval_on_selector_all("iframe", "els => els.map(e => e.getAttribute('src'))")
    for s in srcs:
        print("IFRAME SRC:", s)
    print("image (svg <image>) count:", page.locator("image").count())

    imgs = page.eval_on_selector_all("image", "els => els.map(e => e.getAttribute('href') || e.getAttribute('xlink:href'))")
    print(imgs[:30])

    # also check for elements with pointer cursor near where tree should be, and dump their tag/class
    info = page.evaluate("""
    () => {
        const all = [...document.querySelectorAll('div,span,button')];
        const clickable = all.filter(e => getComputedStyle(e).cursor === 'pointer');
        return clickable.length;
    }
    """)
    print("pointer-cursor elements:", info)

    context.close()

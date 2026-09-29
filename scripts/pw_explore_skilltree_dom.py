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
    page.wait_for_timeout(1500)

    # Find likely container: svg or canvas
    svg_count = page.locator("svg").count()
    canvas_count = page.locator("canvas").count()
    print("svg count:", svg_count, "canvas count:", canvas_count)

    # Look for elements with class containing "node" or "skill"
    for sel in ["[class*=node]", "[class*=skill]", "[data-skill]", "[data-node]", "[data-id]"]:
        c = page.locator(sel).count()
        print(sel, "->", c)

    # Dump outerHTML of first svg if present
    if svg_count > 0:
        html = page.locator("svg").first.evaluate("el => el.outerHTML.slice(0, 3000)")
        Path(OUT_DIR / "_skilltree_svg_snippet.txt").write_text(html, encoding="utf-8")
        print("Wrote svg snippet")

    context.close()

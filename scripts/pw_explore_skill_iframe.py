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
    page.wait_for_timeout(3000)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')
    count_svg = fl.locator("svg").count()
    count_canvas = fl.locator("canvas").count()
    print("iframe svg:", count_svg, "canvas:", count_canvas)

    labels = fl.locator("[aria-label]").all()
    print("aria-label count in iframe:", len(labels))
    for l in labels[:40]:
        try:
            print(l.get_attribute("aria-label"))
        except Exception as e:
            print("err", e)

    titles = fl.locator("[title]").all()
    print("title count in iframe:", len(titles))
    for t in titles[:40]:
        try:
            print("TITLE:", t.get_attribute("title"))
        except Exception:
            pass

    context.close()

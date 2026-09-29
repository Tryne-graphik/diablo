import json
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

requests_log = []

def log_request(req):
    if req.method in ("POST", "PUT", "PATCH") and "infinitybuilds" in req.url:
        body = req.post_data
        requests_log.append({"method": req.method, "url": req.url, "body": body})

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.on("request", log_request)

    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    # check current Skills state first
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(2000)
    page.locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]').scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT_DIR / "_diag_current_skills.png"), full_page=False)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')
    try:
        pts_text = fl.locator("text=SKILL POINTS").first.locator("xpath=..").inner_text(timeout=3000)
        print("Current skill points display:", pts_text)
    except Exception as e:
        print("couldn't read points:", e)

    # zoom out and click ONE known-good node (Flurry-region test point at this zoom) to create a fresh change
    zoom_out_btn = fl.locator('[title="Zoom out"]')
    for i in range(10):
        zoom_out_btn.click()
        page.wait_for_timeout(150)
    page.wait_for_timeout(600)

    page.mouse.click(586, 552)  # Flurry-ish test point from earlier calibration
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_diag_after_test_click.png"), full_page=False)

    print("=== requests captured before Save Draft:", len(requests_log))

    requests_log.append({"marker": "ABOUT TO CLICK SAVE"})
    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(3000)
        print("Save click succeeded")
    except Exception as e:
        print("Save click FAILED:", e)

    print("=== total requests captured:", len(requests_log))
    Path(OUT_DIR / "_diag_requests.json").write_text(json.dumps(requests_log, indent=2), encoding="utf-8")

    context.close()

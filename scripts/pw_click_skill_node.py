from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

requests_log = []

def log_request(req):
    if "tools.infinitybuilds" in req.url or "/api/" in req.url or "trpc" in req.url:
        requests_log.append(f"REQ {req.method} {req.url} postdata={req.post_data}")

responses_log = []
def log_response(res):
    if "tools.infinitybuilds" in res.url or "/api/" in res.url or "trpc" in res.url:
        responses_log.append(f"RES {res.status} {res.url}")

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.on("request", log_request)
    page.on("response", log_response)

    page.goto("https://infinitybuilds.gg/en/builds/new", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    page.click("text=Barbarian")
    page.wait_for_timeout(500)
    page.click("text=Rogue")
    page.wait_for_timeout(1500)
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(2000)
    page.locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]').scroll_into_view_if_needed()
    page.wait_for_timeout(2000)

    requests_log.append("=== BEFORE CLICK MARKER ===")
    page.mouse.click(570, 428)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT_DIR / "_after_node_click.png"), full_page=False)

    context.close()

Path(OUT_DIR / "_skill_click_requests.txt").write_text("\n".join(requests_log), encoding="utf-8")
Path(OUT_DIR / "_skill_click_responses.txt").write_text("\n".join(responses_log), encoding="utf-8")
print("done")

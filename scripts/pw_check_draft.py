from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    resp = page.goto("https://infinitybuilds.gg/api/me", wait_until="domcontentloaded")
    print("me:", resp.status, page.content()[:500] if resp.status != 200 else "")
    try:
        body = page.evaluate("() => fetch('/api/me').then(r => r.json())")
        print("ME JSON:", body)
    except Exception as e:
        print("err", e)

    try:
        drafts = page.evaluate("() => fetch('/api/me/builds?status=draft').then(r => r.json())")
        print("DRAFTS:", drafts)
    except Exception as e:
        print("drafts err:", e)

    context.close()

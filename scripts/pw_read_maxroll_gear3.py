from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent
URL = "https://maxroll.gg/d4/build-guides/twisting-blades-rogue-guide"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1200})
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    try:
        page.get_by_role("button", name="Accept").click(timeout=3000)
        page.wait_for_timeout(500)
    except Exception:
        pass
    try:
        page.get_by_text("Endgame", exact=True).first.click()
        page.wait_for_timeout(1500)
    except Exception as e:
        print("endgame tab click failed:", e)

    equip_heading = page.get_by_text("Equipment", exact=True).first
    equip_heading.scroll_into_view_if_needed()
    page.mouse.wheel(0, 600)
    page.wait_for_timeout(1000)

    # find the equipment list container: rows of icon+name pairs. Try to find
    # all images within the equipment/talisman panels and hover each.
    imgs = page.locator("main img").all()
    print("total main imgs:", len(imgs))

    results = []
    for i, img in enumerate(imgs):
        try:
            box = img.bounding_box()
        except Exception:
            continue
        if not box or box["width"] < 20 or box["height"] < 20:
            continue
        alt = img.get_attribute("alt") or ""
        src = img.get_attribute("src") or ""
        if "item" not in src.lower() and "icon" not in src.lower() and not alt:
            continue
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(cx, cy)
        page.wait_for_timeout(400)
        # find any visible tooltip text on page now
        tooltip_text = page.evaluate("""
        () => {
            const all = [...document.querySelectorAll('div')];
            const candidates = all.filter(d => d.textContent.includes('Item Power') || d.textContent.includes('Ancestral') || d.textContent.includes('Legendary') || d.textContent.includes('Unique'));
            if (candidates.length === 0) return null;
            candidates.sort((a,b) => b.textContent.length - a.textContent.length);
            return candidates[0].textContent.slice(0, 400);
        }
        """)
        results.append({"i": i, "alt": alt, "src": src[-60:], "box": (round(cx), round(cy)), "tooltip": tooltip_text})
        print(i, alt, "->", (tooltip_text or "")[:150])

    Path(OUT_DIR / "_maxroll_gear_tooltips.txt").write_text(
        "\n\n".join(f"{r['i']} | alt={r['alt']} | box={r['box']}\n{r['tooltip']}" for r in results),
        encoding="utf-8"
    )
    browser.close()

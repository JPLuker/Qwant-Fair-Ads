"""Chromium browser smoke test for sponsored-result grouping and click protection."""
from pathlib import Path
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "content.js").read_text()
CSS = (ROOT / "content.css").read_text()
CHROME = os.getenv("QFA_CHROME") or next(
    (p for p in [shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")] if p), None
)
ADS = [
    ("etsy.com", "One-of-A-Kind Graphic T-Shirts - Etsy"),
    ("zazzle.com", "Design Your Own T-shirts - Zazzle T Shirts - No Minimum Orders"),
    ("jp.couponswe.com", "Coupons for Redbubble"),
    ("amazon.com", "Shop custom made t shirts online - Amazon Official Site"),
]


def make_ad(domain, title):
    return f'''<div class="ad-slot"><div class="shell"><article class="result ad-core">
        <h2><a class="title" href="https://www.bing.com/aclk?clk=abc">{title}</a></h2>
        <div class="metadata"><span>{domain}</span> › clothing › <span>Ad</span></div>
        <div class="desc">Detailed promotion.</div>
        <div><h3><a class="promo" href="https://example.com/a">More details</a></h3></div>
    </article></div></div>'''


def fixture(light=False):
    bg, fg = ("#ffffff", "#242629") if light else ("#242629", "#eeeeee")
    return f'''<!doctype html><html><head><style>
        body{{font-family:Arial;background:{bg};color:{fg};margin:0}}
        main{{width:700px;max-width:90vw;margin:30px auto}}
        .ad-slot{{margin:0 0 43px;padding:0;border:0}}
        .title{{font-size:20px;color:#7c9cff;display:block}}
        .metadata{{color:#acb3bb;font-size:13px}}
        .promo{{font-size:17px}}.desc{{font-size:14px}}
        .organic{{margin-bottom:44px}}
    </style></head><body><main id="main"><div id="results">'''+ ''.join(make_ad(*ad) for ad in ADS) + '''
        <article id="organic" class="organic"><h2><a class="title" href="https://redbubble.com">Independent artist clothing and gifts</a></h2><p>Organic description remains.</p></article>
        ''' + make_ad("newad.com", "Completely new sponsored product") + '''</div></main></body></html>'''


def run_page(browser, light=False):
    page = browser.new_page(viewport={"width": 1200, "height": 900})
    page.set_content(fixture(light))
    page.evaluate("""() => {window.chrome = window.chrome || {}; chrome.storage={
        local:{get:(_defaults,cb)=>cb({mode:'compact'})},
        onChanged:{addListener:(cb)=>window.qfaSetMode=(mode)=>cb({mode:{newValue:mode}},'local')}
    }}""")
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)
    page.wait_for_function("document.querySelectorAll('.qcr-group').length === 2")
    data = page.evaluate("""() => ({
      groups:[...document.querySelectorAll('.qcr-group')].map(g=>({
        names:[...g.querySelectorAll('.qcr-domain')].map(e=>e.textContent),
        height:g.getBoundingClientRect().height
      })),
      hidden:[...document.querySelectorAll('.ad-slot')].every(e=>getComputedStyle(e).display==='none'),
      organic:getComputedStyle(document.querySelector('#organic')).display
    })""")
    assert [len(g["names"]) for g in data["groups"]] == [4, 1], data
    assert data["groups"][0]["height"] < 240, data
    assert data["hidden"] and data["organic"] != "none", data
    for (domain, _title), name in zip(ADS, data["groups"][0]["names"]):
        assert domain in name and "bing.com" not in name, name
    assert page.locator("#organic").is_visible()
    assert bool(page.locator(".qcr-group.qcr-light").count()) == light

    page.locator(".qcr-ad-link").first.click()
    assert page.locator(".qcr-modal").count() == 1
    assert "etsy.com" in page.locator(".qcr-modal").inner_text()
    assert "bing.com" in page.locator(".qcr-modal").inner_text()
    page.keyboard.press("Escape")
    assert page.locator(".qcr-modal").count() == 0

    page.locator(".qcr-toggle").first.click()
    assert page.locator(".qcr-list").first.is_hidden()
    assert page.locator(".qcr-list").last.is_visible()
    page.locator(".qcr-toggle").first.click()
    page.evaluate("window.qfaSetMode('minimal')")
    assert page.locator('.qcr-group[data-qcr-mode="minimal"]').count() == 2
    page.evaluate("window.qfaSetMode('collapsed')")
    assert page.locator(".qcr-list").first.is_hidden()
    page.evaluate("window.qfaSetMode('compact')")
    assert page.locator(".qcr-list").first.is_visible()

    page.evaluate("""() => {
      const el=document.createElement('div');el.className='ad-slot';
      el.innerHTML='<article class="result"><h2><a href="https://www.bing.com/aclk">Another sponsored product link</a></h2><div class="metadata">inserted.com · <span>Ad</span></div></article>';
      document.getElementById('organic').before(el);
    }""")
    page.wait_for_function("document.querySelector('.qcr-group .qcr-count')?.textContent === '(5)'")
    page.close()


with sync_playwright() as runner:
    kwargs = {"headless": True, "args": ["--no-sandbox"]}
    if CHROME:
        kwargs["executable_path"] = CHROME
    browser = runner.chromium.launch(**kwargs)
    run_page(browser, light=False)
    run_page(browser, light=True)
    browser.close()
print("PASS: compact grouping, organic isolation, advertiser domain, modal, Escape, collapse, modes, dynamic insertion, light/dark")

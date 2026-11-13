"""Fail-fast, dependency-free extension packaging and permissions checks."""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ["manifest.json", "content.js", "content.css", "popup.html", "popup.js", "LICENSE", "README.md", "PRIVACY.md"]
for name in REQUIRED:
    path = ROOT / name
    assert path.is_file() and path.stat().st_size > 0, f"Missing or empty: {name}"

manifest = json.loads((ROOT / "manifest.json").read_text())
assert manifest["manifest_version"] == 3
assert manifest["name"] == "Qwant Fair Ads"
assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])
assert manifest["permissions"] == ["storage"], "Unexpected extension permission"
assert "host_permissions" not in manifest, "Content-script matches suffice"
assert len(manifest["content_scripts"]) == 1
script = manifest["content_scripts"][0]
assert set(script["matches"]) == {"*://qwant.com/*", "*://*.qwant.com/*"}
assert script["js"] == ["content.js"] and script["css"] == ["content.css"]
assert manifest["action"]["default_popup"] == "popup.html"

code = (ROOT / "content.js").read_text()
popup = (ROOT / "popup.js").read_text()
for path in ["content.js", "popup.js"]:
    subprocess.run(["node", "--check", str(ROOT / path)], check=True)
for forbidden in [r"\bfetch\s*\(", r"\bXMLHttpRequest\b", r"\bsendBeacon\s*\(", r"\beval\s*\(", r"\bnew\s+Function\s*\(", r"\.innerHTML\s*="]:
    assert not re.search(forbidden, code + "\n" + popup), f"Forbidden operation: {forbidden}"
for marker in ["Sponsored results", "aria-expanded", "qcr-modal", "Escape", "qcr-ad-link", "chrome.storage"]:
    assert marker in code, f"Required behavior absent: {marker}"
for mode in ("compact", "minimal", "collapsed"):
    assert mode in code and f'value="{mode}"' in (ROOT / "popup.html").read_text()

for file in ["content.css", "popup.html"]:
    source = (ROOT / file).read_text()
    declarations = re.findall(r"(?:\bfont-size\s*:|\bfont\s*:)([^;{}]+);", source)
    for declaration in declarations:
        sizes = re.findall(r"(?<![\d.])(\d+(?:\.\d+)?)px", declaration)
        if sizes:
            assert float(sizes[0]) >= 12, f"Text under 12px in {file}: {declaration.strip()}"

print("PASS: manifest scope, permissions, source, minimum font size, JS syntax, and packaging inputs")

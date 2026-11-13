# Testing

## Automated checks

Run `python3 tests/verify_extension.py`, `node --check content.js`, and `node --check popup.js` to verify the Manifest V3 configuration, JavaScript syntax, permission scope, self-contained assets, minimum font sizes, and packaging inputs.

Run `python3 tests/browser_smoke.py` with the Python Playwright package and a local Chromium/Chrome browser to verify that consecutive ads group correctly, organic results stay visible, advertiser domains are not replaced by redirect domains, the modal opens and Escape cancels, collapse works, and dynamically added ads are detected.

GitHub Actions runs these checks before it creates a release.

## What automated checks cannot prove

- Compatibility with Qwant's **live** DOM when Qwant changes its page structure.
- That browser-level context-menu actions always show the warning. They do not.
- That an advertiser's redirect is safe or has the displayed destination.
- Real-device installation or keyboard/screen-reader behavior across every Chromium browser.
- Automatic updating: the extension uses manual, unpacked installation.

## Human acceptance

The predecessor v1.7 grouping and click-confirmation behavior was accepted in Vivaldi on November 12, 2026. The renamed v1.0.0 package and accessibility adjustments have **not** been confirmed on real hardware. Keep that artifact out of a tested release until someone checks this exact version.

Suggested acceptance: install the release ZIP unpacked; search Qwant for a term with sponsored results; confirm one header, compact red titles, organic results unchanged, Escape cancellation, popup modes, and refresh behavior.

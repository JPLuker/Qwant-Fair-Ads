# Conventions

- Manifest V3 and plain JavaScript/CSS; no runtime dependencies or remote code.
- Only Qwant pages may receive a content script. Keep the sole extension permission `storage` unless a feature truly needs another.
- Namespaced UI classes and attributes use `qcr-`; never style organic result elements directly.
- Prefer preserving the DOM and hiding recognized ad containers to deleting page nodes.
- Never rely only on a link's hostname for the advertiser. Qwant's paid links may redirect through Bing.
- Keep the click confirmation cancel-first, keyboard-accessible, and honest about safety limitations.
- Keep all public user-facing copy short and concrete.
- On changes, verify JavaScript syntax, manifest scope, local Chromium smoke behavior, and release ZIP contents.
- Source version lives in `manifest.json`; use Semantic Versioning and document changes in `CHANGELOG.md`.

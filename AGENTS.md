# Qwant Fair Ads development notes

Use the relevant standards in `JPLuker/InternalDesignGuidelines` when working on this project, particularly SOP.md, CODING.md, WORKFLOW.md, DESIGN.md Part A, PRIVACY.md, SECURITY-BASELINE.md, VERSIONING.md and RELEASES.md. They are project defaults; preserve the approved Qwant appearance.

## Core rules

- Never mistake an organic result for an ad. A visible sponsored label is required before replacement.
- Do not hide a result until the replacement metadata has been extracted.
- A failed detection should leave the original search result visible.
- Treat URLs and ad DOM nodes as untrusted input; never use `innerHTML` with page data.
- Never use external runtime scripts, fonts, telemetry, or broader host permissions.
- No cosmetic redesign without approval. Keep the red titles and small sponsored-result presentation.
- Tests must cover consecutive ads, organic boundaries, redirects, dynamic insertion, keyboard cancellation, and display modes.
- Use GitHub Issues for work that remains open. Record precisely what has and has not been tested.

## Deviations and scope

- **Browser extension rather than OS package:** one cross-platform Chromium ZIP is used instead of OS/architecture-specific artifacts.
- **Preferences:** the only stored state is display mode in `chrome.storage.local`; a standalone export/data-folder screen would create needless complexity. Removing the extension clears its stored preference.
- **Manual updates:** unpacked extensions do not self-update. GitHub Releases and the README document replacement; no background version polling is added.
- **No version overlay:** Chromium's extension management page shows the manifest version; the compact popup doesn't need a permanent version label.
- **No landing page yet:** README and GitHub Releases handle documentation for this small single-purpose extension. Reconsider if distribution expands.
- **Release status:** do not call a renamed or changed package tested solely because a previous prototype was tested. Untested artifacts use a separately labeled pre-release.

## Files

- `manifest.json`: permissions, extension name and version, the single version source of truth.
- `content.js`: ad detection, summary groups and navigation confirmation.
- `content.css`: extension-owned result and dialog styling.
- `popup.html` / `popup.js`: display-mode controls.
- `tests/`: validation and simulated Chromium regression tests.

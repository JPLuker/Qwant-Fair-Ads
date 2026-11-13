# Privacy — Qwant Fair Ads

Qwant Fair Ads runs locally inside the browser on Qwant search pages.

- **Data collection:** None. It does not send searches, browsing activity, or personal information to the developer or an analytics provider.
- **Local storage:** The selected display mode (`compact`, `minimal`, or `collapsed`) is stored using `chrome.storage.local`.
- **Network:** The extension does not make its own remote requests or contact a developer-operated server. When the user approves a sponsored link, the browser navigates to that link normally; the linked page or its redirectors may collect data under their own policies.
- **Site access:** The content script is limited to `qwant.com` and its subdomains. It inspects page markup to identify sponsored results and adds a confirmation dialogue to sponsored-link clicks.
- **Permissions:** `storage` only. No history, tabs, cookies, or network-request permissions are requested.

This is an independent open-source project, not affiliated with Qwant.

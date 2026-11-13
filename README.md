# Qwant Fair Ads

A lightweight, independent Chromium extension that makes sponsored results on [Qwant](https://www.qwant.com/) smaller, clearly identifiable, and harder to open accidentally.

**Not affiliated with or endorsed by Qwant.**

## Features

- Groups consecutive sponsored results into a compact section instead of displaying oversized advertisement cards.
- Shows small **red ad titles**, advertiser domains and **Ad** labels.
- Lets you expand or collapse sponsored sections.
- Offers three display modes: **Compact**, **Minimal**, and **Collapsed**.
- Asks for confirmation before opening a sponsored link and identifies redirects where possible.
- Leaves organic search results alone.
- Saves your chosen display mode locally, without analytics or tracking.

## Install

1. Download or clone this repository.
2. Open `vivaldi://extensions`, `chrome://extensions`, or `brave://extensions`.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the directory containing `manifest.json`.
5. Refresh Qwant.

To update, replace the extension files and select **Reload** in your browser's extensions page.

## Usage

Click the extension toolbar icon to choose a mode. Compact shows two lines per sponsored result; Minimal displays one line; Collapsed starts with a closed sponsored-results section. Clicking an ad title displays a confirmation with advertiser and linked hostname. Press **Escape** or **Cancel** to stay on Qwant.

## Privacy

No search queries, browsing history, or personal information are collected or sent anywhere. The extension runs locally and uses `storage` solely for the chosen display mode. See [PRIVACY.md](PRIVACY.md).

## Limitations

- Not an ad blocker, anti-malware scanner, or website safety service.
- Some browser-level actions (such as the context menu's *Open link in new tab*) can bypass the click confirmation.
- Qwant may change its markup and break some detection or layout functionality.
- Some ad redirects conceal their final destination.
- Chromium browsers are the intended platform.

## Network connections

The extension makes no independent network requests. It reads the Qwant page that's already open and only follows a sponsored link after you choose Continue.

| Host | When | What's sent |
|---|---|---|
| None | No extension-initiated requests | Nothing |
| Sponsored link destination (varies) | Only when you choose Continue | A normal browser navigation, subject to the destination's own policies |

No telemetry. No account required. Nothing is sold or shared.

## Support

Issues are monitored. Report bugs or request features through [GitHub Issues](https://github.com/JPLuker/Qwant-Fair-Ads/issues/new/choose). Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## Testing and releases

[TESTING.md](TESTING.md) explains the automated checks and limitations. Browser-extension builds without a real-device test are marked **UNTESTED** and published separately from tested releases.

## Development

Plain JavaScript, CSS, Manifest V3, and no external dependencies. Load the directory unpacked to test.

## License

MIT — see [LICENSE](LICENSE).

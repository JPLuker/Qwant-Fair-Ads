# Things learned

## Grouping and CSS (November 12, 2026)

- The Qwant DOM can place spacing on wrappers outside a result card. Shrinking text alone leaves blank space; clipping outer containers cuts descriptions in half.
- Group **consecutive** sponsored results under one header. A header per detected ad can make the redesigned page larger than the original.
- Extract the displayed advertiser hostname from page text. The click URL may point to a Bing/Qwant tracking endpoint.
- Build the replacement only after locating a genuine Ad label and usable title/link. Do not alter organic results.
- Test a second DOM arrangement with expanded sitelinks; Qwant can place titles and advertisers in a different order.

## Verification

- A screenshot or headless browser test confirms only that fixture, not compatibility with the live Qwant website.
- Record the precise version tested on hardware before labeling a release as tested.

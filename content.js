(() => {
  'use strict';

  // The only page elements that receive styling are those created below.
  // Original ad cards are retained in the DOM, but hidden while their concise
  // representations are displayed. Organic result nodes are never modified.
  const MODES = new Set(['compact', 'minimal', 'collapsed']);
  const AD_LABEL = /^(?:ad|ads|sponsored|advertisement|annonce|publicité)$/i;
  const DOMAIN = /(?:^|\b)((?:[a-z\d-]+\.)+[a-z]{2,})(?:\b|\/|$)/i;
  const records = new Map();
  const rendered = new Set();
  const groupOrigins = new WeakMap();
  const rememberedCollapse = new WeakMap();
  let mode = 'compact';
  let pendingScan = false;
  let modalOpen = false;
  let nextGroupId = 0;

  const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const isOwn = (el) => Boolean(el?.closest?.('.qcr-group, .qcr-modal-backdrop'));
  const isLabel = (el) => el instanceof Element &&
    !el.children.length && el.textContent.length < 26 &&
    AD_LABEL.test(cleanText(el.textContent)) && !isOwn(el);

  function safeURL(link) {
    try {
      const url = new URL(link.href, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function countLabels(el) {
    let count = 0;
    if (isLabel(el)) count++;
    for (const sub of el.querySelectorAll('span,small,div,em,b')) {
      if (isLabel(sub) && ++count > 1) break;
    }
    return count;
  }

  function titleLink(root, label) {
    // Prefer semantic titles. Qwant also uses styled links in some versions.
    for (const heading of root.querySelectorAll('h2,h3,[role="heading"]')) {
      const link = heading.closest('a[href]') || heading.querySelector('a[href]');
      if (link && safeURL(link) && cleanText(link.textContent).length > 4) return link;
    }
    const labelTop = label?.getBoundingClientRect?.().top ?? 0;
    let best = null;
    let bestScore = -Infinity;
    for (const link of root.querySelectorAll('a[href]')) {
      const url = safeURL(link);
      const txt = cleanText(link.textContent);
      if (!url || txt.length < 13 || txt.length > 190 || AD_LABEL.test(txt)) continue;
      if (/^(?:https?:\/\/)?(?:www\.)?[^\s]+\.[a-z]{2,}(?:\s*[›\/].*)?$/i.test(txt)) continue;
      const rect = link.getBoundingClientRect();
      const style = getComputedStyle(link);
      const fontSize = parseFloat(style.fontSize) || 12;
      const score = fontSize * 4 + Math.min(txt.length, 90) / 8 +
        (rect.top >= labelTop - 2 ? 9 : -15) -
        (txt.length > 120 ? 12 : 0);
      if (score > bestScore) { best = link; bestScore = score; }
    }
    return best;
  }

  function countProminentLinks(root) {
    let count = 0;
    for (const link of root.querySelectorAll('a[href]')) {
      const text = cleanText(link.textContent);
      // H3 links beneath an H2 are usually ad sitelinks, not new results.
      if (link.closest('h3') && root.querySelector('h2')) continue;
      if (text.length < 18 || text.length > 190 || !safeURL(link)) continue;
      const size = parseFloat(getComputedStyle(link).fontSize) || 0;
      if (size >= 15.5 && ++count > 1) break;
    }
    return count;
  }

  function findCard(label) {
    if (!isLabel(label)) return null;
    const existing = label.closest('[data-qcr-original]');
    if (existing && records.has(existing)) return existing;

    // Prefer a real result boundary. It also includes expanded sitelinks and
    // other promotional widgets so no oversized fragments are left behind.
    const structural = label.closest(
      'article, [data-testid="adResult"], [data-testid="webResult"], .search-result-item--ad, .search-result-item, .result'
    );
    if (structural && !isOwn(structural) && countLabels(structural) === 1 &&
        titleLink(structural, label) &&
        !structural.matches('main,[role="main"],body')) return structural;

    let current = label.parentElement;
    let best = null;
    for (let depth = 0; current && depth < 10; depth++, current = current.parentElement) {
      if (current.matches('main,[role="main"],body,html,nav,header,footer')) break;
      if (isOwn(current)) break;
      const links = current.querySelectorAll('a[href]');
      if (links.length > 28 || countLabels(current) > 1) break;
      // If a generic wrapper contains two prominent result links, it is
      // likely the list containing both an ad and an organic result.
      if (countProminentLinks(current) > 1) break;
      // An ad may contain several H3 sitelinks. Treat a second primary H2
      // as the start of another result, but don't stop merely for sitelinks.
      if (current.querySelectorAll('h2,[role="heading"][aria-level="2"]').length > 1) break;
      if (current.querySelectorAll('h2').length === 0 &&
          current.querySelectorAll('h3,[role="heading"]').length > 1) break;
      // Do not replace a whole search-results region or a sidebar.
      if (current.textContent.length > 2200) break;
      if (links.length && titleLink(current, label)) best = current;
    }
    if (!best) return null;
    if (best.querySelectorAll('a[href]').length > 28 || countLabels(best) !== 1) return null;
    return best;
  }

  function findExclusiveShell(root) {
    // Find the highest wrapper containing ONLY this result. Qwant often keeps
    // margin/gap on a parent wrapper, so hiding just the headline card leaves
    // a large empty slot in the results list.
    let shell = root;
    for (let depth = 0; depth < 7; depth++) {
      const parent = shell.parentElement;

'use strict';
const valid = new Set(['compact', 'minimal', 'collapsed']);
chrome.storage.local.get({ mode: 'compact' }, ({ mode }) => {
  const radio = document.querySelector(`input[value="${valid.has(mode) ? mode : 'compact'}"]`);
  if (radio) radio.checked = true;
});
document.getElementById('options').addEventListener('change', (event) => {
  const mode = event.target.value;
  if (valid.has(mode)) chrome.storage.local.set({ mode });
});

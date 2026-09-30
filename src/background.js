// Remembers the Authorization header the tl;dv web app sends to its own API,
// so the downloader can make the same calls as you. Kept in session storage:
// it is cleared when the browser closes and never leaves this machine.

// Chrome hides Authorization unless asked with 'extraHeaders'; Firefox always
// shows it and rejects the option.
const extraInfo = ['requestHeaders'];
if (Object.values(chrome.webRequest.OnBeforeSendHeadersOptions || {}).includes('extraHeaders')) {
  extraInfo.push('extraHeaders');
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const header = (details.requestHeaders || []).find((h) => h.name.toLowerCase() === 'authorization');
    if (header && /^Bearer\s+\S+/i.test(header.value || '')) {
      chrome.storage.session.set({ authToken: header.value, authSeenAt: Date.now() });
    }
  },
  { urls: ['https://gw.tldv.io/*', 'https://gaia.tldv.io/*'] },
  extraInfo,
);

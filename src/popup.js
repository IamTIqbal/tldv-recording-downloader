import { meetingIdFromUrl, titleFromTab } from './lib/tldv.js';

const $ = (id) => document.getElementById(id);

// Firefox lets people switch site access off after installing. Without it the
// extension can't see the tab's address or the tl;dv login.
const tldvOrigins = chrome.runtime.getManifest().host_permissions;
const hasAccess = await chrome.permissions.contains({ origins: tldvOrigins });

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const meetingId = tab && meetingIdFromUrl(tab.url || '');
const { authToken } = await chrome.storage.session.get('authToken');

if (!hasAccess) {
  $('meeting-title').textContent = 'Access to tl;dv is off';
  $('message').textContent = 'Allow access to tldv.io, then reload your recording.';
  $('allow').hidden = false;
  $('allow').onclick = () => {
    chrome.permissions.request({ origins: tldvOrigins }).then((granted) => granted && window.close());
  };
} else if (!meetingId) {
  $('meeting-title').textContent = 'No recording on this tab';
  $('message').textContent = 'Open one of your recordings on tldv.io, then click here again.';
} else {
  $('meeting-title').textContent = titleFromTab(tab.title) || 'tl;dv recording';
  if (!authToken) {
    $('message').textContent = 'Reload the page once so the extension can use your tl;dv login.';
    $('reload').hidden = false;
    $('reload').onclick = () => {
      chrome.tabs.reload(tab.id);
      window.close();
    };
  } else {
    $('message').textContent = 'Ready to download';
    $('download').hidden = false;
    $('download').onclick = () => {
      const params = new URLSearchParams({ meeting: meetingId, tab: String(tab.id) });
      chrome.tabs.create({ url: `downloader.html?${params}` });
      window.close();
    };
  }
}

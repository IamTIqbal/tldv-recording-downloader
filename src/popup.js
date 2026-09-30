import { meetingIdFromUrl, titleFromTab } from './lib/tldv.js';

const $ = (id) => document.getElementById(id);

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const meetingId = tab && meetingIdFromUrl(tab.url || '');
const { authToken } = await chrome.storage.session.get('authToken');

if (!meetingId) {
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

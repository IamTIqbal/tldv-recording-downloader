import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meetingIdFromUrl, buildFilename, sanitizeFilename, parseWatchPage, titleFromTab, formatDuration, formatDate,
} from '../src/lib/tldv.js';

test('titleFromTab strips the app suffix', () => {
  assert.equal(titleFromTab('Weekly Sync | tl;dv'), 'Weekly Sync');
  assert.equal(titleFromTab('Design review - tldv'), 'Design review');
  assert.equal(titleFromTab('tl;dv'), null);
  assert.equal(titleFromTab(undefined), null);
});

test('formatDuration and formatDate give short readable labels', () => {
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(42), '42 s');
  assert.equal(formatDuration(47 * 60 + 10), '47 min');
  assert.equal(formatDuration(3600 + 5 * 60), '1 h 5 min');
  assert.equal(formatDate('2026-09-29T10:00:00.000Z', 'en-GB'), '29 Sept 2026');
  assert.equal(formatDate('nope'), null);
});

test('meetingIdFromUrl finds the id on tldv meeting pages only', () => {
  assert.equal(meetingIdFromUrl('https://tldv.io/app/meetings/66f1a2b3c4d5e6f708192a3b'), '66f1a2b3c4d5e6f708192a3b');
  assert.equal(meetingIdFromUrl('https://tldv.io/app/meetings/66f1a2b3c4d5e6f708192a3b/notes?x=1'), '66f1a2b3c4d5e6f708192a3b');
  assert.equal(meetingIdFromUrl('https://app.tldv.io/meetings/66f1a2b3c4d5e6f708192a3b'), '66f1a2b3c4d5e6f708192a3b');
  assert.equal(meetingIdFromUrl('https://tldv.io/app/meetings'), null);
  assert.equal(meetingIdFromUrl('https://evil-tldv.io/app/meetings/66f1a2b3c4d5e6f708192a3b'), null);
  assert.equal(meetingIdFromUrl('not a url'), null);
});

test('buildFilename uses the meeting date and a safe name', () => {
  assert.equal(buildFilename({ name: 'Weekly Sync: Q3/Q4 plan?', createdAt: '2026-09-29T14:00:00.000Z' }, 'mp4'),
    '2026-09-29_Weekly-Sync-Q3Q4-plan.mp4');
  assert.match(buildFilename({ name: null, createdAt: 'garbage' }, 'ts'), /^\d{4}-\d{2}-\d{2}_tldv-meeting\.ts$/);
  assert.equal(sanitizeFilename('...'), 'tldv-meeting');
});

test('parseWatchPage tolerates missing fields', () => {
  assert.deepEqual(parseWatchPage({ meeting: { name: 'A', createdAt: 'B' } }), { name: 'A', createdAt: 'B' });
  assert.deepEqual(parseWatchPage(null), { name: null, createdAt: null });
});

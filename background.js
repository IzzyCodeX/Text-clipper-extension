// background.js (Manifest V3 service worker)
// Responsible for:
// - Context menu: save selection
// - Saving clips into chrome.storage.local
// - Dark mode storage
// - Update clip details
// - Pin/unpin clips

const STORAGE_KEY = 'clips';
const THEME_KEY = 'themePreference';

function makeId() {
  return 'clip_' + Date.now() + '_' + Math.random().toString(16).slice(2);
}

async function getClips() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setClips(clips) {
  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
}

async function saveClip(clip) {
  const clips = await getClips();
  clips.unshift(clip);
  await setClips(clips);
  return clip;
}

async function getTheme() {
  const data = await chrome.storage.local.get(THEME_KEY);
  return data[THEME_KEY] || 'light';
}

async function setTheme(theme) {
  await chrome.storage.local.set({ [THEME_KEY]: theme });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save selection to Research Clipper',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId !== 'save-selection') return;
    const selectionText = (info.selectionText || '').trim();
    if (!selectionText) return;

    const clip = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      url: info.pageUrl || tab?.url || '',
      title: tab?.title || '',
      selectionText,
      tags: [],
      project: '',
      notes: '',
      pinned: false
    };

    await saveClip(clip);

    if (chrome.action && chrome.action.setBadgeText) {
      await chrome.action.setBadgeText({ text: '✓', tabId: tab?.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab?.id }), 1200);
    }
  } catch (err) {
    console.error('Context menu clip failed:', err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || !message.type) {
        sendResponse({ ok: false, error: 'Invalid message' });
        return;
      }

      if (message.type === 'SAVE_CLIP') {
        const clip = message.clip;
        if (!clip || !clip.selectionText) {
          sendResponse({ ok: false, error: 'Missing clip content' });
          return;
        }
        const saved = await saveClip(clip);
        sendResponse({ ok: true, clip: saved });
        return;
      }

      if (message.type === 'GET_CLIPS') {
        const clips = await getClips();
        sendResponse({ ok: true, clips });
        return;
      }

      if (message.type === 'DELETE_CLIP') {
        const id = message.id;
        const clips = await getClips();
        const next = clips.filter(c => c.id !== id);
        await setClips(next);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'UPDATE_CLIP') {
        const updated = message.clip;
        if (!updated || !updated.id) {
          sendResponse({ ok: false, error: 'Missing clip id' });
          return;
        }
        const clips = await getClips();
        const idx = clips.findIndex(c => c.id === updated.id);
        if (idx === -1) {
          sendResponse({ ok: false, error: 'Clip not found' });
          return;
        }
        clips[idx] = { ...clips[idx], ...updated };
        await setClips(clips);
        sendResponse({ ok: true, clip: clips[idx] });
        return;
      }

      if (message.type === 'TOGGLE_PIN') {
        const id = message.id;
        const clips = await getClips();
        const clip = clips.find(c => c.id === id);
        if (!clip) {
          sendResponse({ ok: false, error: 'Clip not found' });
          return;
        }
        clip.pinned = !clip.pinned;
        await setClips(clips);
        sendResponse({ ok: true, pinned: clip.pinned });
        return;
      }

      if (message.type === 'CLEAR_ALL') {
        await setClips([]);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'GET_THEME') {
        const theme = await getTheme();
        sendResponse({ ok: true, theme });
        return;
      }

      if (message.type === 'SET_THEME') {
        const theme = message.theme || 'light';
        await setTheme(theme);
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message type' });
    } catch (err) {
      console.error('Background message handler error:', err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true;
});

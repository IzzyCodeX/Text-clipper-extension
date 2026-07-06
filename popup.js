let lastSelection = null;

// ─── Dark Mode ───
async function loadTheme() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_THEME' });
    if (res && res.ok && res.theme) {
      document.documentElement.setAttribute('data-theme', res.theme);
      updateThemeIcon(res.theme);
    }
  } catch {
    // default to light
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateThemeIcon(next);
  await chrome.runtime.sendMessage({ type: 'SET_THEME', theme: next });
}

// ─── Helpers ───
function trimPreview(s, max = 400) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function getSelectionFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab');

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selectionText = (window.getSelection && window.getSelection().toString()) || '';
      return {
        selectionText: selectionText.trim(),
        url: location.href,
        title: document.title
      };
    }
  });

  const data = result && result[0] && result[0].result;
  if (!data) throw new Error('Could not read selection');
  return data;
}

function parseTags(raw) {
  return (raw || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg || '';
}

function setPreview(text) {
  document.getElementById('selectionPreview').textContent = text || '(nothing yet)';
}

function setSaveEnabled(enabled) {
  document.getElementById('saveBtn').disabled = !enabled;
}

// ─── Core Actions ───
async function refreshSelection() {
  setStatus('Reading selection…');
  setSaveEnabled(false);
  try {
    const data = await getSelectionFromPage();
    lastSelection = data;

    if (!data.selectionText) {
      setPreview('(no text selected — highlight text on the page)');
      setStatus('No selection found.');
      return;
    }

    setPreview(trimPreview(data.selectionText));
    setStatus('Selection ready.');
    setSaveEnabled(true);
  } catch (err) {
    console.error(err);
    setPreview('(could not read selection on this page)');
    setStatus('Error: ' + (err && err.message ? err.message : String(err)));
  }
}

async function saveClip() {
  if (!lastSelection || !lastSelection.selectionText) return;

  const tags = parseTags(document.getElementById('tagsInput').value);
  const project = (document.getElementById('projectInput').value || '').trim();
  const notes = (document.getElementById('notesInput').value || '').trim();

  const clip = {
    id: 'clip_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    createdAt: new Date().toISOString(),
    url: lastSelection.url,
    title: lastSelection.title,
    selectionText: lastSelection.selectionText,
    tags,
    project,
    notes,
    pinned: false
  };

  setStatus('Saving…');
  setSaveEnabled(false);

  const res = await chrome.runtime.sendMessage({ type: 'SAVE_CLIP', clip });
  if (res && res.ok) {
    setStatus('✅ Saved! Click "Refresh selection" to clip again.');
    lastSelection = null;
    setPreview('(saved — refresh selection to clip again)');
    setSaveEnabled(false);

    document.getElementById('tagsInput').value = '';
    document.getElementById('projectInput').value = '';
    document.getElementById('notesInput').value = '';
    return;
  } else {
    setStatus('Save failed: ' + (res && res.error ? res.error : 'Unknown error'));
    setSaveEnabled(true);
  }
}

async function openLibrary() {
  await chrome.runtime.openOptionsPage();
}

// ─── Event Listeners ───
document.getElementById('refreshBtn').addEventListener('click', refreshSelection);
document.getElementById('saveBtn').addEventListener('click', saveClip);
document.getElementById('openLibraryBtn').addEventListener('click', openLibrary);
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+S or Cmd+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (!document.getElementById('saveBtn').disabled) {
      saveClip();
    }
  }

  // Ctrl+R or Cmd+R to refresh (override default reload)
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    refreshSelection();
  }
});

// Initialize
loadTheme();
refreshSelection();

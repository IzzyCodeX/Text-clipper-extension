let lastSelection = null; 

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

  const clip = {
    id: 'clip_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    createdAt: new Date().toISOString(),
    url: lastSelection.url,
    title: lastSelection.title,
    selectionText: lastSelection.selectionText,
    tags,
    project
  };

  setStatus('Saving…');
  setSaveEnabled(false);

  const res = await chrome.runtime.sendMessage({ type: 'SAVE_CLIP', clip });
  if (res && res.ok) {
    setStatus('Saved! Now click "Refresh selection" to clip again.');
    lastSelection = null;
    setPreview('(saved - refresh selection to clip again)');
    setSaveEnabled(false);

    document.getElementById('tagsInput').value = '';
    document.getElementById('projectInput').value= '';
    return;
  } else {
    setStatus('Save failed: ' + (res && res.error ? res.error : 'Unknown error'));
    setSaveEnabled(true);
  }
}

async function openLibrary() {
  await chrome.runtime.openOptionsPage();
}

document.getElementById('refreshBtn').addEventListener('click', refreshSelection);
document.getElementById('saveBtn').addEventListener('click', saveClip);
document.getElementById('openLibraryBtn').addEventListener('click', openLibrary);
refreshSelection();

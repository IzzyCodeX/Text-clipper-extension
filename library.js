// library.js
// Beginner-friendly library UI: list clips, filter, delete, export (copy-to-clipboard)

function $(id) {
  return document.getElementById(id);
}

function escapeMd(s) {
  return (s || '').replace(/\|/g, '\\|');
}

function clipToMarkdown(clip) {
  const created = clip.createdAt ? new Date(clip.createdAt).toLocaleString() : '';
  const tags = Array.isArray(clip.tags) && clip.tags.length ? `Tags: ${clip.tags.join(', ')}` : '';
  const project = clip.project ? `Project: ${clip.project}` : '';
  const metaLine = [created, project, tags].filter(Boolean).join(' • ');

  // Markdown blockquote + source
  return [
    `> ${clip.selectionText.replace(/\n/g, '\n> ')}`,
    '',
    `— **${escapeMd(clip.title || 'Untitled')}** (${clip.url})`,
    metaLine ? `_${metaLine}_` : '',
    ''
  ].filter(Boolean).join('\n');
}

function matchesFilter(clip, q, tag, project) {
  const qLower = (q || '').trim().toLowerCase();
  const tagLower = (tag || '').trim().toLowerCase();
  const projLower = (project || '').trim().toLowerCase();

  if (tagLower) {
    const tags = Array.isArray(clip.tags) ? clip.tags : [];
    const has = tags.some(t => String(t).toLowerCase() === tagLower);
    if (!has) return false;
  }

  if (projLower) {
    if (String(clip.project || '').toLowerCase() !== projLower) return false;
  }

  if (!qLower) return true;

  const hay = [
    clip.title,
    clip.url,
    clip.selectionText,
    (clip.tags || []).join(' '),
    clip.project
  ].join(' ').toLowerCase();

  return hay.includes(qLower);
}

async function loadClips() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_CLIPS' });
  if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Failed to load');
  return res.clips || [];
}

function render(clips) {
  const list = $('list');
  list.innerHTML = '';

  if (!clips.length) {
    list.innerHTML = `<div class="muted">No clips yet. Highlight text on a webpage and save it using the popup or right-click menu.</div>`;
    return;
  }

  for (const clip of clips) {
    const el = document.createElement('div');
    el.className = 'item';

    const created = clip.createdAt ? new Date(clip.createdAt).toLocaleString() : '';

    const tagsHtml = (Array.isArray(clip.tags) ? clip.tags : [])
      .map(t => `<span class="tag">${t}</span>`)
      .join('');

    el.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="title">${clip.title || 'Untitled'}</div>
          <div class="meta">${created} • <a href="${clip.url}" target="_blank" rel="noreferrer">${clip.url}</a>${clip.project ? ` • Project: ${clip.project}` : ''}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="smallBtn" data-copy-md="${clip.id}">Copy MD</button>
          <button class="smallBtn" data-delete="${clip.id}">Delete</button>
        </div>
      </div>
      <div class="quote">${(clip.selectionText || '').replace(/</g, '&lt;')}</div>
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
    `;

    list.appendChild(el);
  }
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function refresh() {
  $('status').textContent = 'Loading…';
  const clips = await loadClips();

  const q = $('searchInput').value;
  const tag = $('tagInput').value;
  const project = $('projectInput').value;

  const filtered = clips.filter(c => matchesFilter(c, q, tag, project));
  $('status').textContent = `Showing ${filtered.length} of ${clips.length} clip(s).`;
  render(filtered);

  // Wire up click handlers after render
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete');
      if (!id) return;
      await chrome.runtime.sendMessage({ type: 'DELETE_CLIP', id });
      refresh();
    });
  });

  document.querySelectorAll('[data-copy-md]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-copy-md');
      const all = await loadClips();
      const clip = all.find(c => c.id === id);
      if (!clip) return;
      await copyText(clipToMarkdown(clip));
      $('status').textContent = 'Copied one clip as Markdown.';
    });
  });
}

async function copyAllJson() {
  const clips = await loadClips();
  await copyText(JSON.stringify(clips, null, 2));
  $('status').textContent = 'Copied all clips as JSON.';
}

async function copyAllMarkdown() {
  const clips = await loadClips();
  const md = clips.map(clipToMarkdown).join('\n');
  await copyText(md);
  $('status').textContent = 'Copied all clips as Markdown.';
}

async function clearAll() {
  const ok = confirm('Delete ALL clips? This cannot be undone.');
  if (!ok) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
  refresh();
}

$('refreshBtn').addEventListener('click', refresh);
$('copyJsonBtn').addEventListener('click', copyAllJson);
$('copyMdBtn').addEventListener('click', copyAllMarkdown);
$('clearAllBtn').addEventListener('click', clearAll);

$('searchInput').addEventListener('input', () => {
  // light debounce-ish behavior for beginners
  clearTimeout(window.__t);
  window.__t = setTimeout(refresh, 200);
});
$('tagInput').addEventListener('input', () => {
  clearTimeout(window.__t);
  window.__t = setTimeout(refresh, 200);
});
$('projectInput').addEventListener('input', () => {
  clearTimeout(window.__t);
  window.__t = setTimeout(refresh, 200);
});

refresh();

let refreshTimer = null;
chrome.storage.onChanged.addListener((changes, areaName) => {
 if (areaName !== 'local' ) return ;
 if (!changes.)
})

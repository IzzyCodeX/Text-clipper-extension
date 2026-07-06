// library.js
// Research Clipper Library UI
// Features: list, filter, sort, pin, edit, notes, dark mode, export (JSON/Markdown/PDF), import, keyboard shortcuts

function $(id) {
  return document.getElementById(id);
}

// ─── Dark Mode ───
async function loadTheme() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_THEME' });
    if (res && res.ok && res.theme) {
      document.documentElement.setAttribute('data-theme', res.theme);
      updateThemeIcon(res.theme);
    }
  } catch (err) {
    // Silent fallback to light theme on first load
    console.log('Theme load failed, using light:', err);
  }
}

function updateThemeIcon(theme) {
  const btn = $('themeToggle');
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

// ─── Markdown Helpers ───
function escapeMd(s) {
  return (s || '').replace(/\|/g, '\\|');
}

function clipToMarkdown(clip) {
  const created = clip.createdAt ? new Date(clip.createdAt).toLocaleString() : '';
  const tags = Array.isArray(clip.tags) && clip.tags.length ? `Tags: ${clip.tags.join(', ')}` : '';
  const project = clip.project ? `Project: ${clip.project}` : '';
  const notes = clip.notes ? `Notes: ${clip.notes}` : '';
  const metaLine = [created, project, tags, notes].filter(Boolean).join(' • ');

  return [
    `> ${clip.selectionText.replace(/\n/g, '\n> ')}`,
    '',
    `— **${escapeMd(clip.title || 'Untitled')}** (${clip.url})`,
    metaLine ? `_${metaLine}_` : '',
    ''
  ].filter(Boolean).join('\n');
}

// ─── Filtering ───
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
    clip.notes,
    (clip.tags || []).join(' '),
    clip.project
  ].join(' ').toLowerCase();

  return hay.includes(qLower);
}

// ─── Sorting ───
function sortClips(clips, sortField, pinnedFirst) {
  const sorted = [...clips];
  const [field, direction] = sortField.split('-');
  const dir = direction === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
    if (pinnedFirst && a.pinned !== b.pinned) {
      return b.pinned ? 1 : -1;
    }

    let valA, valB;
    if (field === 'date') {
      valA = new Date(a.createdAt || 0).getTime();
      valB = new Date(b.createdAt || 0).getTime();
    } else if (field === 'title') {
      valA = (a.title || '').toLowerCase();
      valB = (b.title || '').toLowerCase();
    } else if (field === 'project') {
      valA = (a.project || '').toLowerCase();
      valB = (b.project || '').toLowerCase();
    } else {
      valA = new Date(a.createdAt || 0).getTime();
      valB = new Date(b.createdAt || 0).getTime();
    }

    if (field === 'date') {
      return (valA - valB) * dir;
    }
    return valA < valB ? -1 * dir : valA > valB ? 1 * dir : 0;
  });

  return sorted;
}

// ─── Data ───
async function loadClips() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_CLIPS' });
  if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Failed to load');
  return res.clips || [];
}

// ─── Rendering ───
function render(clips) {
  const list = $('list');
  list.innerHTML = '';

  if (!clips.length) {
    list.innerHTML = `<div class="muted" style="padding: 20px; text-align: center;">
      <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
      No clips yet. Highlight text on a webpage and save it using the popup or right-click menu.
    </div>`;
    return;
  }

  for (const clip of clips) {
    const el = document.createElement('div');
    el.className = 'item' + (clip.pinned ? ' pinned' : '');
    el.setAttribute('data-id', clip.id);

    const created = clip.createdAt ? new Date(clip.createdAt).toLocaleString() : '';

    const tagsHtml = (Array.isArray(clip.tags) ? clip.tags : [])
      .map(t => `<span class="tag tag-clickable" data-tag="${t}">${t}</span>`)
      .join('');

    const notesHtml = clip.notes
      ? `<div class="notes">📝 ${clip.notes.replace(/</g, '&lt;')}</div>`
      : '';

    const pinIcon = clip.pinned ? '<span class="pin-icon">⭐</span>' : '';

    el.innerHTML = `
      <div class="itemTop">
        <div style="flex: 1;">
          <div class="title">${pinIcon}${clip.title || 'Untitled'}</div>
          <div class="meta">${created} • <a href="${clip.url}" target="_blank" rel="noreferrer">${clip.url}</a>${clip.project ? ` • 📁 ${clip.project}` : ''}</div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink: 0;">
          <button class="smallBtn pin ${clip.pinned ? 'active' : ''}" data-pin="${clip.id}" title="${clip.pinned ? 'Unpin' : 'Pin to top'}">⭐</button>
          <button class="smallBtn" data-copy-md="${clip.id}">📋</button>
          <button class="smallBtn" data-edit="${clip.id}">✏️</button>
          <button class="smallBtn danger" data-delete="${clip.id}">🗑️</button>
        </div>
      </div>
      <div class="quote">${(clip.selectionText || '').replace(/</g, '&lt;')}</div>
      ${notesHtml}
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
    `;

    list.appendChild(el);
  }

  // Wire up click handlers
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete');
      if (!id) return;
      if (!confirm('Delete this clip?')) return;
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
      $('status').textContent = '✅ Copied one clip as Markdown.';
    });
  });

  document.querySelectorAll('[data-pin]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-pin');
      if (!id) return;
      await chrome.runtime.sendMessage({ type: 'TOGGLE_PIN', id });
      refresh();
    });
  });

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-edit');
      if (!id) return;
      openEditModal(id);
    });
  });

  document.querySelectorAll('.tag-clickable').forEach(tag => {
    tag.addEventListener('click', () => {
      $('tagInput').value = tag.getAttribute('data-tag');
      refresh();
    });
  });
}

// ─── Edit Modal ───
let currentEditClip = null;

async function openEditModal(id) {
  const all = await loadClips();
  const clip = all.find(c => c.id === id);
  if (!clip) return;

  currentEditClip = clip;
  $('editClipId').value = clip.id;
  $('editTitle').value = clip.title || '';
  $('editText').value = clip.selectionText || '';
  $('editTags').value = (Array.isArray(clip.tags) ? clip.tags : []).join(', ');
  $('editProject').value = clip.project || '';
  $('editNotes').value = clip.notes || '';
  $('editModal').style.display = 'flex';
}

function closeEditModal() {
  $('editModal').style.display = 'none';
  currentEditClip = null;
}

async function saveEdit() {
  const id = $('editClipId').value;
  if (!id) return;

  const updated = {
    id,
    title: $('editTitle').value.trim(),
    selectionText: $('editText').value.trim(),
    tags: $('editTags').value.split(',').map(t => t.trim()).filter(Boolean),
    project: $('editProject').value.trim(),
    notes: $('editNotes').value.trim()
  };

  const res = await chrome.runtime.sendMessage({ type: 'UPDATE_CLIP', clip: updated });
  if (res && res.ok) {
    $('status').textContent = '✅ Clip updated.';
    closeEditModal();
    refresh();
  } else {
    $('status').textContent = '❌ Update failed: ' + (res && res.error ? res.error : 'Unknown error');
  }
}

// ─── Import ───
function openImportModal() {
  $('importTextarea').value = '';
  $('importFileInput').value = '';
  $('importModal').style.display = 'flex';
}

function closeImportModal() {
  $('importModal').style.display = 'none';
}

async function importClips() {
  let jsonStr = $('importTextarea').value.trim();
  const fileInput = $('importFileInput');

  if (!jsonStr && fileInput.files.length > 0) {
    jsonStr = await fileInput.files[0].text();
  }

  if (!jsonStr) {
    $('status').textContent = '❌ No JSON data provided.';
    return;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const clips = Array.isArray(parsed) ? parsed : [parsed];

    let imported = 0;
    for (const raw of clips) {
      const clip = {
        id: 'clip_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        createdAt: raw.createdAt || new Date().toISOString(),
        url: raw.url || '',
        title: raw.title || 'Imported Clip',
        selectionText: raw.selectionText || '',
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        project: raw.project || '',
        notes: raw.notes || '',
        pinned: raw.pinned || false
      };

      if (clip.selectionText) {
        await chrome.runtime.sendMessage({ type: 'SAVE_CLIP', clip });
        imported++;
      }
    }

    $('status').textContent = `✅ Imported ${imported} clip(s).`;
    closeImportModal();
    refresh();
  } catch (err) {
    $('status').textContent = '❌ Invalid JSON: ' + err.message;
  }
}

// ─── Clipboard ───
async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

// ─── PDF Export ───
async function exportPdf() {
  const clips = await loadClips();
  const sortField = $('sortField').value;
  const pinnedFirst = $('pinnedFirst').checked;
  const sorted = sortClips(clips, sortField, pinnedFirst);

  // Build HTML content for printing
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Research Clipper Export</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #111; }
    h1 { font-size: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
    .clip { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
    .clip.pinned { border-color: #fbbf24; background: #fffbeb; }
    .title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .quote { white-space: pre-wrap; font-size: 13px; line-height: 1.5; padding: 8px; background: #f9fafb; border-radius: 6px; }
    .notes { margin-top: 8px; padding: 8px; background: #eff6ff; border-left: 3px solid #2563eb; font-size: 12px; color: #4b5563; }
    .tags { margin-top: 8px; }
    .tag { display: inline-block; font-size: 11px; border: 1px solid #e5e7eb; border-radius: 999px; padding: 2px 8px; color: #6b7280; margin-right: 4px; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print { .clip { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>📚 Research Clipper Export</h1>
  <p style="color: #6b7280; font-size: 13px;">${sorted.length} clips exported on ${new Date().toLocaleString()}</p>
  ${sorted.map(clip => {
    const created = clip.createdAt ? new Date(clip.createdAt).toLocaleString() : '';
    const tags = (Array.isArray(clip.tags) ? clip.tags : []).map(t => `<span class="tag">${t}</span>`).join('');
    const notes = clip.notes ? `<div class="notes">📝 ${clip.notes.replace(/</g, '&lt;')}</div>` : '';
    const pin = clip.pinned ? ' pinned' : '';
    return `
      <div class="clip${pin}">
        <div class="title">${clip.pinned ? '⭐ ' : ''}${clip.title || 'Untitled'}</div>
        <div class="meta">${created} • ${clip.url}${clip.project ? ` • Project: ${clip.project}` : ''}</div>
        <div class="quote">${(clip.selectionText || '').replace(/</g, '&lt;')}</div>
        ${notes}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>
    `;
  }).join('')}
  <div class="footer">Generated by Research Clipper</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } else {
    URL.revokeObjectURL(url);
  }
}

// ─── Refresh ───
async function refresh() {
  $('status').textContent = 'Loading…';
  const clips = await loadClips();

  const q = $('searchInput').value;
  const tag = $('tagInput').value;
  const project = $('projectInput').value;
  const sortField = $('sortField').value;
  const pinnedFirst = $('pinnedFirst').checked;

  let filtered = clips.filter(c => matchesFilter(c, q, tag, project));
  filtered = sortClips(filtered, sortField, pinnedFirst);

  const pinnedCount = filtered.filter(c => c.pinned).length;
  const statusParts = [`Showing ${filtered.length} of ${clips.length} clip(s).`];
  if (pinnedCount > 0) statusParts.push(`${pinnedCount} pinned.`);

  $('status').textContent = statusParts.join(' ');
  render(filtered);
}

// ─── Bulk Copy ───
async function copyAllJson() {
  const clips = await loadClips();
  await copyText(JSON.stringify(clips, null, 2));
  $('status').textContent = '✅ Copied all clips as JSON.';
}

async function copyAllMarkdown() {
  const clips = await loadClips();
  const md = clips.map(clipToMarkdown).join('\n');
  await copyText(md);
  $('status').textContent = '✅ Copied all clips as Markdown.';
}

async function clearAll() {
  const ok = confirm('Delete ALL clips? This cannot be undone.');
  if (!ok) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
  refresh();
}

// ─── Event Listeners ───
$('refreshBtn').addEventListener('click', refresh);
$('copyJsonBtn').addEventListener('click', copyAllJson);
$('copyMdBtn').addEventListener('click', copyAllMarkdown);
$('clearAllBtn').addEventListener('click', clearAll);
$('exportPdfBtn').addEventListener('click', exportPdf);
$('importJsonBtn').addEventListener('click', openImportModal);
$('themeToggle').addEventListener('click', toggleTheme);

$('sortField').addEventListener('change', refresh);
$('pinnedFirst').addEventListener('change', refresh);

// Edit modal
$('editSaveBtn').addEventListener('click', saveEdit);
$('editCancelBtn').addEventListener('click', closeEditModal);
$('editModal').addEventListener('click', (e) => {
  if (e.target === $('editModal')) closeEditModal();
});

// Import modal
$('importConfirmBtn').addEventListener('click', importClips);
$('importCancelBtn').addEventListener('click', closeImportModal);
$('importModal').addEventListener('click', (e) => {
  if (e.target === $('importModal')) closeImportModal();
});

// Search debounce
$('searchInput').addEventListener('input', () => {
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to close modals
  if (e.key === 'Escape') {
    if ($('editModal').style.display === 'flex') closeEditModal();
    if ($('importModal').style.display === 'flex') closeImportModal();
  }

  // Ctrl+F or Cmd+F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    $('searchInput').focus();
  }

  // Ctrl+N or Cmd+N to focus search (new clip context)
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    $('searchInput').focus();
    $('searchInput').select();
  }
});

// Storage change listener
let refreshTimer = null;
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (!changes.clips) return;

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh(), 150);
});

// ─── Init ───
loadTheme();
refresh();

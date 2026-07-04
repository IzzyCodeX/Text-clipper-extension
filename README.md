# Research Clipper (Text Only) — beginner-friendly Chrome extension

This is a simple **Manifest V3** Chrome extension that saves highlighted text into a local library.

## What it does
- Highlight text on any page
- Save it using:
  - the popup (click the extension icon)
  - OR right-click → **Save selection to Research Clipper**
- Open the library (Options page) to search, delete, and export (copy JSON/Markdown)

## Install (Developer mode)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `research-clipper-extension/`

## Notes
- Data is stored locally via `chrome.storage.local`
- Screenshot support is intentionally skipped to keep the code easy to learn

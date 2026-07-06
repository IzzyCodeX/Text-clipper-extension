# Research Clipper

A lightweight Chrome extension built with **Manifest V3** that allows you to save highlighted text from any webpage into a local library. Perfect for researchers, students, and anyone who wants to collect information while browsing.

## Features

- **Save highlighted text** — Select text on any page, click save or use the right-click context menu
- **Dark mode** — Toggle between light and dark themes (persisted across sessions)
- **Tags & Projects** — Organize clips with custom tags and project names
- **Notes** — Add personal notes and context to any saved clip
- **Edit clips** — Modify text, tags, project, and notes after saving
- **Pin/Favorite** — Pin important clips to keep them at the top of your library
- **Sort options** — Sort by date, title, or project (ascending/descending)
- **Search** — Full-text search across text, titles, URLs, tags, and notes
- **Export as PDF** — Print your library to a beautifully formatted PDF
- **Export as JSON/Markdown** — Copy all clips in JSON or Markdown format
- **Import from JSON** — Import clips from a JSON file or paste
- **Keyboard shortcuts** — `Ctrl+S` to save, `Ctrl+F` to search, `Ctrl+Shift+L` to open library

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current selection (in popup) |
| `Ctrl+F` | Focus search (in library) |
| `Ctrl+Shift+S` | Quick save selection |
| `Ctrl+Shift+L` | Open library |
| `Escape` | Close modals |

## Install

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Load unpacked → Select folder

## Tech Stack

- Manifest V3
- Vanilla JavaScript (no frameworks)
- Chrome Storage API
- CSS Custom Properties (dark mode)

## Author

IzzyCodeX

## License

MIT

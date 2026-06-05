# Chainsaw Man Todo (电锯人待办)

A Chainsaw Man-themed desktop todo app built with Electron + Vanilla JS + SQLite.

## Screenshots

> TODO: add screenshots

## Features

### Core Todo Management
- Add, edit, delete, and reorder todos via drag-and-drop
- Three types: Normal, Daily (resets daily), Weekly (resets Monday)
- ISO week-based organization with week navigation
- Set reminder times with Windows native notifications

### Pull Cord Completion
- Drag the triangle handle to "start the chainsaw" and complete a todo
- SVG dynamic cable follows mouse movement with tension coloring
- Spring-back animation when released below threshold

### Scoring System
- 10 daisy flower boxes for 0-10 scoring
- Hover preview and click-lock confirmation

### Pochita Desktop Pet
- 8-frame walking sprite animation patrolling left-right
- Click to make Pochita jump (cumulative stacking)
- **Battle System**: After completing a todo, Pochita transforms into battle mode
  - Rises to the todo position with battle sprite animation
  - 4 progressive crack strikes + 1 final shatter
  - SVG crack effects, spark particles, and debris shards
  - Completed todo is visually destroyed and removed from the list

### Audio (Web Audio API)
- 4 audio tracks from the Chainsaw Man anime OST
- Startup sound on pull-cord drag, idle loop while holding
- Battle BGM during destruction sequence
- Strike SFX layered over BGM during combat
- Zero-latency playback via pre-decoded AudioBuffers

### Weekly Summary
- Average score with Makima evaluation (11 dialogue levels, 0-10)
- 11 Makima chibi illustrations matching each score tier
- Stats: completed/total count, max/min scores

### Settings
- Mute toggle for all audio
- Auto-start with Windows (HKCU registry, no admin required)

### System Tray
- Minimize to tray, double-click to restore
- Right-click tray menu: Show Window / Quit

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+N` | New todo |
| `Escape` | Close all modals/menus |

## Tech Stack

- **Electron** 35 — frameless transparent window
- **Vanilla JS** — no framework
- **sql.js** — pure JS SQLite (WASM)
- **Web Audio API** — zero-latency audio
- **sharp + ffmpeg-static** — image/video processing (dev tools)

## Project Structure

```
chainsawman/
├── main.js              # Electron main process
├── preload.js           # contextBridge IPC
├── src/
│   ├── index.html       # Main window
│   ├── main.js          # Renderer: UI logic, audio, pull cord, scoring
│   ├── pet.js           # Pochita desktop pet
│   └── styles/
│       ├── main.css     # App styles
│       └── pet.css      # Pet styles
├── assets/
│   ├── audio/           # startup, idle, bgm, strike (mp3)
│   └── images/          # Pochita sprites, Makima images
├── scripts/             # Image/video generation tools (Python + Node.js)
└── docs/                # Requirements, tech specs, design docs
```

## Development

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build Windows installer
npx electron-builder --win
```

## Version History

| Version | Key Changes |
|---------|-------------|
| v3.4 | Drag-and-drop reorder, keyboard shortcuts, code cleanup |
| v3.3 | Home view toggle (incomplete/completed), migrate to this week |
| v3.2 | Web Audio API, auto-start path fix, trimmed startup audio |
| v3.1 | Pochita battle system: 5 strikes + directional cracks + shatter VFX |
| v2.x | Pochita desktop pet: walk sprite, jump, patrol |
| v1.x | Core todo CRUD, pull cord, scoring, summary, settings |

## License

MIT

# ChitChat — Modern Real-time Team Messaging Frontend

A sleek, responsive, and secure chat interface built with **React**, **Vite**, and **Vanilla CSS**. Designed with premium dark aesthetics and 100% vector SVG icons.

---

## ✨ Features

- **⚡ Real-Time WebSocket Communication**:
  - Live chat messaging and automated reconnection handling.
  - Granular message status tracking:
    - Single tick (`✓`) = Sent to server
    - Double gray ticks (`✓✓`) = Delivered to recipient(s)
    - Double blue ticks (`✓✓`) = Read by all participants
- **🎨 Modern Dark Design System**:
  - Custom dark theme with curated HSL palettes, smooth micro-interactions, and modal dialogs.
  - 100% pure inline SVG iconography (no external glyph fonts or emojis).
  - Fully responsive layout with mobile drawer navigation and smooth scroll behavior.
- **🛡️ Secure Token Management**:
  - Automatic JWT access token refresh and session expiration handling.
  - Visual security badges for cryptographic signature and tamper validation.
- **💬 Room & Participant Management**:
  - Create custom rooms with capacity limits.
  - Join existing rooms via Room ID.
  - View member list, roles, and message receipt inspection popups.

---

## 🛠️ Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 8
- **Styling**: Vanilla CSS (CSS Design System with custom tokens)
- **Linter**: Oxlint
- **Icons**: Inline Vector SVGs

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Backend running on `http://localhost:8080`

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The frontend will be live at `http://localhost:5173`.

### 3. Production Build & Lint

```bash
npm run build
npm run lint
```

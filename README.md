# TermiChat

**Ephemeral, end-to-end encrypted chat rooms that self-destruct.**

A real-time chat application built for privacy-first communication. Rooms automatically expire after 10 minutes, messages are end-to-end encrypted, and no data persists after the session ends. Designed for quick, secure conversations without leaving a trace.

## Motivation

Built out of necessity during college computer labs where phones aren't allowed. Communicating between lab computers was a pain — there was no quick way to send a message, a code snippet, or just ask a question to the person sitting two seats away.

The idea: create a dead-simple chat room that works in a browser. No accounts, no installs, no phone needed. Just type a room code and start talking. The self-destructing nature ensures no chat history lingers on shared lab computers.

And since most of what gets shared between lab computers is code, the app had to handle code properly — syntax highlighting, paste detection, and proper formatting preservation.

## Features

- **Real-Time Messaging** — Low-latency WebSocket communication via a dedicated Bun server. Messages delivered in milliseconds.
- **Self-Destructing Rooms** — Rooms expire after 10 minutes with a live countdown timer. Host can destroy the room instantly at any time.
- **End-to-End Encryption (E2EE)** — AES-256-GCM encryption with PBKDF2 key derivation (100k iterations). The server never sees plaintext — only relays ciphertext. Key derived from room code alone — no key exchange protocol, no URL changes, verbal sharing possible.
- **Code Snippet Sharing** — Syntax highlighting via highlight.js (Python, JS, TS, Java, C, Go, Rust). Paste multi-line indented code and it auto-detects as a code block. Manual toggle available for typed code. Hover-to-copy with visual feedback.
- **WebSocket Reconnection** — Exponential backoff on disconnect (1s → 2s → 4s → cap 30s). Skips reconnection if room is expired or intentionally destroyed. Distinguishes intentional close from unexpected drop.
- **Connection Status Indicator** — Real-time status in header: green = connected, amber pulsing = reconnecting (with attempt count), red = disconnected.
- **Session Storage Persistence** — Encrypted messages saved to sessionStorage on page unload. Restored on reload with automatic decryption. Cleared on room destruction or expiry.
- **Message History for Late Joiners** — Redis Streams store last 100 messages with matching room TTL. New users joining after messages are sent can retrieve recent conversation history. Hybrid approach: existing users use sessionStorage (no Redis call), late joiners fetch from Redis Stream.
- **Rate Limiting** — Server-side protection against message spam (10 messages per 5 seconds per user). Client UI adapts by disabling the send button during cooldown.
- **Input Validation** — Zod schemas validate all API requests and WebSocket messages. Malformed data is rejected before processing.
- **Room Authorization** — Only verified room members can destroy rooms. Token-based authentication via cookies.
- **Heartbeat Ping/Pong** — Client sends ping every 30 seconds to keep WebSocket connections alive.
- **Terminal-Inspired UI** — Dark, high-contrast interface with JetBrains Mono font. Custom thin scrollbars, auto-expanding textarea, toast notifications. Clean, developer-centric experience built with Tailwind CSS v4.

## Architecture

TermiChat uses a decoupled two-process architecture:

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Next.js (Port 3000)   │     │   Bun WS Server (8080)  │
│                         │     │                         │
│  • Pages & Routing      │     │  • WebSocket Connections│
│  • API Routes (Hono)    │     │  • Message Broadcasting │
│  • Proxy Middleware     │     │  • XADD to Redis Stream │
│  • Client-side E2EE     │     │  • Rate Limiting        │
│  • Code Highlighting    │     │  • Zod Validation       │
│  • Paste Detection      │     │  • Auth Verification    │
│  • History Fetch        │     │  • Exponential Reconnect│
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────┬───────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Upstash Redis    │
              │                   │
              │  • Room Metadata  │
              │  • User Tokens    │
              │  • Room TTL       │
              │  • Message Stream │  ← Last 100 messages
              └───────────────────┘
```

**Why two processes?** WebSockets require persistent stateful connections. By separating the WebSocket server from Next.js, each process can be scaled, deployed, and restarted independently. The WS server runs on Bun for maximum WebSocket throughput, while Next.js handles routing, pages, and the API.

## Performance

A single Bun WebSocket server can handle:

| Metric | Capacity |
|---|---|
| Concurrent WebSocket connections | 50,000 – 100,000+ |
| Concurrent rooms (3 users each) | 16,000 – 33,000 |
| New rooms per minute | ~3,300 |
| Room code combinations (nanoid 5) | ~1 billion |
| Room TTL | 10 minutes |
| Max users per room | 3 |

## Security

- **E2EE**: Messages encrypted client-side with AES-256-GCM. Server only sees ciphertext.
- **Key derivation**: PBKDF2 with 100k iterations, room code as passphrase. No key stored on server. Both users derive identical keys independently — no key exchange needed.
- **Rate limiting**: In-memory per-token sliding window on WS server. Prevents message flooding.
- **Input validation**: Zod schemas enforce correct message shape and API request format. Max 5000 characters per message.
- **Destroy authorization**: Only verified room members can destroy rooms (sismember token check).
- **Ephemeral by design**: No message persistence. SessionStorage stores encrypted ciphertext — cleared on room destruction.
- **Cookie-based tokens**: Unique nanoid token per user, verified against Redis set on every WebSocket connection.

## Code Snippet Sharing

The app handles code as a first-class citizen, not an afterthought:

```
User pastes indented code
  → onPaste detects multi-line + indentation
  → auto-enables code mode
  → Enter sends
  → highlight.js renders with syntax highlighting
  → hover to copy
```

**Detection logic:** On paste, the app checks if the pasted content is multi-line AND has consistent indentation (at least one line starts with spaces or tabs). If both conditions are met, the message is marked as code automatically. A toggle button allows manual override for typed code.

**Supported languages:** Python, JavaScript, TypeScript, Java, C, Go, Rust (tree-shaken imports to keep bundle small).

### Limitations

**PDF Copy Issue:** When copying code from PDF files, the PDF reader strips indentation and whitespace at the source level — this is not an application bug, but a fundamental limitation of how PDFs store and expose text. The clipboard API cannot recover data that was never preserved in the first place.

**Why not solved:** Implementing a workaround (such as in-app code editors, special paste dialogs, or custom clipboard handling) would introduce significant complexity — adding code editor components, managing their state, handling mobile compatibility, and building custom input flows. This would bloat the application beyond its original purpose: a simple, lightweight chat for quick secure conversations. For a project of this scope, the pragmatic solution is to document the limitation and guide users to copy from sources that preserve formatting.

**Workaround:** Copy code directly from:
- Web pages / documentation / blogs
- GitHub, GitLab, Bitbucket
- Code editors (VS Code, Sublime, etc.)
- Any plain-text or HTML-based source

These sources preserve indentation in the clipboard, and the app's code detection works correctly with them.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| API | Hono (running on Vercel/Next.js) |
| WebSocket Server | Hono + Bun (native WebSocket + pub/sub) |
| Database | Redis (Upstash) — ephemeral state with TTL |
| Validation | Zod v4 (discriminated unions for message types) |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| Syntax Highlighting | highlight.js (core + 7 languages) |
| Icons | lucide-react (Code, Copy, Check) |
| Language | TypeScript |
| Font | JetBrains Mono |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) (for the WebSocket server)
- [Upstash Redis](https://upstash.com/) account (free tier works)

### Installation

```bash
git clone <repository-url>
cd nextjschatapp
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
SALT_KEY=your_salt_for_key_derivation
PORT=8080
```

### Running the App

The app requires two processes — the Next.js frontend and the Bun WebSocket server.

**PowerShell (Windows):**
```powershell
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — WebSocket server
bun src/ws-server.ts
```

**Git Bash / WSL / macOS:**
```bash
npm run dev:all
```

> **Note:** `npm run dev:all` uses `&` for background processes which only works in bash-compatible shells. For PowerShell, use two separate terminals.

### Usage

1. Open `http://localhost:3000`
2. Click **"CREATE SECURE ROOM"** to generate a new room
3. Share the room code with a friend (e.g., `xK3f2`)
4. They enter the code and click **"JOIN"**
5. Chat securely — paste code for automatic syntax highlighting
6. The room self-destructs after 10 minutes

## How It Works

1. **Room Creation** — Server generates a 5-character room code via nanoid. Room metadata and expiry stored in Redis with a 10-minute TTL.
2. **Join Flow** — Proxy middleware validates the room exists, assigns a unique token via cookie, and adds the user to the room's member set (max 3).
3. **Key Derivation** — Client derives an AES-256-GCM encryption key from the room code using PBKDF2 (100k iterations, SHA-256). Both users derive the same key independently — no key exchange protocol needed.
4. **Encrypted Messaging** — Messages encrypted client-side before sending. Each message gets a unique random 12-byte IV. Server relays ciphertext via WebSocket broadcast. Receiving client decrypts with the shared key.
5. **Message History** — When a message is sent, it's also stored in Redis Stream (`messages:${roomId}`) with XADD and trimmed to last 100 entries via XTRIM. Stream TTL synced with room TTL. New users joining late can fetch recent messages via the history API.
6. **Buffer & Merge** — When loading history, client connects to WebSocket first, then fetches history. WS messages arriving during fetch are buffered. After history loads, buffered messages are merged and displayed.
7. **Code Detection** — On paste, checks for multi-line + indentation. Auto-marks as code. Toggle button for manual override. Code blocks rendered with highlight.js syntax highlighting.
8. **Reconnection** — On unexpected disconnect, client reconnects with exponential backoff (1s, 2s, 4s... cap 30s). Intentional closes (room destroy, expiry) skip reconnection.
9. **Destruction** — When destroyed (manually or via TTL), Redis keys (room metadata, user tokens, message stream) are deleted and all connected clients are redirected to home. SessionStorage is cleared.

## Deployment

- **Frontend** — Deployed on [Vercel](https://vercel.com)
- **Backend (WebSocket Server)** — Docker container deployed on Microsoft Azure via GitHub Actions CI/CD pipeline (builds to `ghcr.io`)

## Future Enhancements

- Room settings — custom TTL and user limit when creating a room
- Larger room sizes — support more than 3 users per room
- File sharing — encrypted file transfer between room members
- Message reactions — lightweight emoji reactions without persistence


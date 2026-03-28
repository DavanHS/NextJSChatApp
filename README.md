# TermiChat

**Ephemeral, end-to-end encrypted chat rooms that self-destruct.**

A real-time chat application built for privacy-first communication. Rooms automatically expire after 10 minutes, messages are end-to-end encrypted, and no data persists after the session ends. Designed for quick, secure conversations without leaving a trace.

## Motivation

Built out of necessity during college computer labs where phones aren't allowed. Communicating between lab computers was a pain — there was no quick way to send a message, a code snippet, or just ask a question to the person sitting two seats away.

The idea: create a dead-simple chat room that works in a browser. No accounts, no installs, no phone needed. Just type a room code and start talking. The self-destructing nature ensures no chat history lingers on shared lab computers.

One limitation still being worked on: the chat doesn't preserve code formatting (indentation, whitespace), which matters when sharing Python snippets or other whitespace-sensitive code.

## Features

- **Real-time Messaging** — Low-latency WebSocket communication via a dedicated Bun server. Messages delivered in milliseconds.
- **Self-Destructing Rooms** — Rooms expire after 10 minutes with a live countdown timer. Host can destroy the room instantly at any time.
- **End-to-End Encryption (E2EE)** — AES-256-GCM encryption with PBKDF2 key derivation (100k iterations). The server never sees plaintext — only relays ciphertext.
- **Rate Limiting** — Server-side protection against message spam (10 messages per 5 seconds per user). Client UI adapts by disabling the send button during cooldown.
- **Input Validation** — Zod schemas validate all API requests and WebSocket messages. Malformed data is rejected before processing.
- **Room Authorization** — Only verified room members can destroy rooms. Token-based authentication via cookies.
- **Connection Resilience** — Heartbeat ping/pong every 30 seconds to keep connections alive. Graceful error handling with user-facing feedback.
- **Terminal-Inspired UI** — Dark, high-contrast interface with JetBrains Mono font. Clean, developer-centric experience built with Tailwind CSS.

## Architecture

TermiChat uses a decoupled two-process architecture:

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Next.js (Port 3000)   │     │   Bun WS Server (8080)  │
│                         │     │                         │
│  • Pages & Routing      │     │  • WebSocket Connections│
│  • API Routes (Hono)    │     │  • Message Broadcasting │
│  • Proxy Middleware     │     │  • Rate Limiting        │
│  • Client-side E2EE     │     │  • Zod Validation       │
│                         │     │  • Auth Verification    │
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
- **Key derivation**: PBKDF2 with 100k iterations, room code as passphrase. No key stored on server.
- **Rate limiting**: In-memory per-token tracking on WS server. Prevents message flooding.
- **Input validation**: Zod schemas enforce correct message shape and API request format.
- **Destroy authorization**: Only verified room members can destroy rooms (sismember token check).
- **Ephemeral by design**: No message persistence. SessionStorage cleared on room destruction.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| API | Hono (running on Vercel/Next.js) |
| WebSocket Server | Hono + Bun (native WebSocket) |
| Database | Redis (Upstash) — ephemeral state |
| Validation | Zod v4 |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
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

**Git Bash (Windows):**
```bash
# Run both simultaneously
npm run dev:all
```

**WSL (Windows Subsystem for Linux):**
```bash
# Terminal 1
npm run dev

# Terminal 2
bun src/ws-server.ts
```

**macOS / Linux:**
```bash
# Terminal 1
npm run dev

# Terminal 2
bun src/ws-server.ts
```

> **Note:** `npm run dev:all` uses `&` for background processes which only works in bash-compatible shells (Git Bash, macOS terminal, WSL). For PowerShell, use two separate terminals.

### Usage

1. Open `http://localhost:3000`
2. Click **"CREATE SECURE ROOM"** to generate a new room
3. Share the room code with a friend (e.g., `xK3f2`)
4. They enter the code and click **"JOIN"**
5. Chat securely — the room self-destructs after 10 minutes

## How It Works

1. **Room Creation** — Server generates a 5-character room code via nanoid. Room metadata and expiry stored in Redis with a 10-minute TTL.
2. **Join Flow** — Proxy middleware validates the room exists, assigns a unique token via cookie, and adds the user to the room's member set (max 3).
3. **Key Exchange** — Client derives an AES-256-GCM encryption key from the room code using PBKDF2 (100k iterations). Both users derive the same key — no key sharing needed.
4. **Encrypted Messaging** — Messages encrypted client-side before sending. Server relays ciphertext via WebSocket broadcast. Receiving client decrypts with the shared key.
5. **Destruction** — When destroyed (manually or via TTL), Redis keys are deleted and all connected clients are redirected to home. SessionStorage is cleared.

## Deployment

- **Frontend** — Deployed on [Vercel](https://vercel.com)
- **Backend (WebSocket Server)** — Deployed on Microsoft Azure via GitHub Actions CI/CD pipeline

## Future Enhancements

- [ ] Code snippet formatting — preserve indentation and whitespace for sharing code
- [ ] Room settings — custom TTL and user limit when creating a room
- [ ] Reconnection with exponential backoff
- [ ] Connection status indicator
- [ ] Larger room sizes — support more than 3 users per room


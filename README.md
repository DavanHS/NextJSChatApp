# TermiChatApp

A high-performance, real-time chat application featuring secure, self-destructing rooms and a terminal-inspired aesthetic. [cite_start]Built with a modern decoupled architecture using Next.js and a dedicated ElysiaJS WebSocket server[cite: 1, 3, 5].

## 🚀 Features

* [cite_start]**Real-time Messaging**: Instant communication powered by WebSockets via ElysiaJS for low-latency delivery[cite: 3, 4].
* [cite_start]**Self-Destructing Rooms**: Chat rooms are temporary by design, automatically expiring after a set duration (default: 10 minutes) to ensure privacy[cite: 4, 5].
* [cite_start]**Host Control**: Room creators can manually destroy the room at any time, instantly disconnecting all participants and purging room data[cite: 4, 5].
* [cite_start]**Live Countdown**: A synchronized visual timer notifies users exactly how much time remains before the room and its history are destroyed[cite: 4].
* [cite_start]**Redis Integration**: Utilizes Redis for room metadata management, TTL (Time-To-Live) enforcement, and Pub/Sub for cross-server message broadcasting[cite: 3, 5].
* [cite_start]**Terminal-Inspired UI**: A sleek, high-contrast dark interface built with Tailwind CSS, designed for a focused developer-centric experience[cite: 4].

## 🛠️ Tech Stack

* [cite_start]**Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS.
* [cite_start]**Backend/WS**: ElysiaJS (running on Bun/Node), WebSockets[cite: 1, 3].
* [cite_start]**Database**: Redis (Upstash) for ephemeral state and Pub/Sub[cite: 1, 5].
* [cite_start]**Utilities**: Zod (validation), Nanoid (unique ID generation), TypeScript.

## 📦 Getting Started

### Prerequisites

* [cite_start]Node.js (v20+) or Bun.
* A Redis instance (e.g., Upstash).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd NextJSChatApp
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory:
    ```env
    NEXT_PUBLIC_URL=http://localhost:3000
    NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
    UPSTASH_REDIS_REST_URL=your_redis_url
    UPSTASH_REDIS_REST_TOKEN=your_redis_token
    PORT=8080
    ```

### Running the App

[cite_start]Start both the Next.js development server and the WebSocket server simultaneously using the pre-configured script:

```bash
npm run dev:all

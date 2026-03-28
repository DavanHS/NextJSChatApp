import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { cors } from 'hono/cors';
import { redis } from './lib/redis';
import type { ServerWebSocket } from 'bun';
import { z } from 'zod';

const wsMessageSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('PING') }),
    z.object({
        type: z.literal('MESSAGE'),
        payload: z.object({
            text: z.string().min(1, "text is required").max(5000, "message too long"),
            sender: z.string().min(1, "sender is required"),
            username: z.string().min(1, "username is required"),
            iv: z.string().optional(),
        }),
    }),
    z.object({ type: z.literal('ROOM_DESTROYED') }),
])

const messageLog = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5000;

function isRateLimited(token: string): boolean {
    const now = Date.now();
    const timestamps = messageLog.get(token) || [];
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);

    if (recent.length >= RATE_LIMIT) {
        return true;
    }

    recent.push(now);
    messageLog.set(token, recent);
    return false;
}

const app = new Hono();

app.use('/*', cors({
    origin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    credentials: true
}));

app.get('/ws', upgradeWebSocket((c) => {
    const roomId = c.req.query('roomId');
    const token = c.req.query('token');
    const username = c.req.query('username');

    return {
        async onOpen(event, ws) {
            if (!roomId || !token) {
                ws.close();
                return;
            }

            const isAllowed = await redis.sismember(`room:${roomId}:users`, token);
            if (!isAllowed) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Not authorized" }));
                ws.close();
                return;
            }

            const rawWs = ws.raw as ServerWebSocket;

            rawWs.subscribe(roomId);
            console.log(`User ${token} connected to room ${roomId}`);

            rawWs.publish(roomId, JSON.stringify({
                type: "USER_JOINED",
                token: token,
                username: username,
                time: Date.now()
            }));
        },

        onMessage(event, ws) {
            if (!roomId) return;

            try {
                const raw = JSON.parse(event.data.toString());

                if (raw.type === "PING") {
                    ws.send(JSON.stringify({ type: "PONG" }));
                    return;
                }

                const parsed = wsMessageSchema.safeParse(raw);
                if (!parsed.success) {
                    console.error("Invalid WS message:", parsed.error.issues);
                    return;
                }

                if (parsed.data.type === "MESSAGE" && isRateLimited(token!)) {
                    ws.send(JSON.stringify({
                        type: "WARNING",
                        message: "Too many messages. Slow down."
                    }));
                    return;
                }

                const rawWs = ws.raw as ServerWebSocket;

                if (parsed.data.type === "MESSAGE") {
                    rawWs.publish(roomId, JSON.stringify({
                        type: "MESSAGE",
                        payload: {
                            ...parsed.data.payload,
                            time: Date.now()
                        }
                    }));
                } else {
                    rawWs.publish(roomId, JSON.stringify(parsed.data));
                }
            } catch (error) {
                console.error("Failed to parse incoming WebSocket message", error);
            }
        },

        onClose(event, ws) {
            if (roomId) {
                const rawWs = ws.raw as ServerWebSocket;
                rawWs.unsubscribe(roomId);
                console.log(`User ${token} disconnected from room ${roomId}`);
            }
            if (token) {
                messageLog.delete(token);
            }
        }
    };
}));

export default {
    port: process.env.PORT || 8080,
    fetch: app.fetch,
    websocket,
};
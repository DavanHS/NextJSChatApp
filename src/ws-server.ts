import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { cors } from 'hono/cors';
import { redis } from './lib/redis';
import type { ServerWebSocket } from 'bun';

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
                const message = JSON.parse(event.data.toString());

                if (message.type === "PING") {
                    ws.send(JSON.stringify({ type: "PONG" }));
                    return;
                }

                const rawWs = ws.raw as ServerWebSocket;
                rawWs.publish(roomId, JSON.stringify({
                    ...message,
                    time: Date.now()
                }));
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
        }
    };
}));

export default {
    port: process.env.PORT || 8080,
    fetch: app.fetch,
    websocket,
};
import { redis } from '@/lib/redis';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { nanoid } from 'nanoid'
import { z } from 'zod'

export const ROOM_TTL_MILISECONDS = 60 * 10 * 1000

const destroySchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
    token: z.string().min(1, "token is required"),
})

const historySchema = z.object({
    roomId: z.string().min(1, "roomId is required"),
})

const roomApp = new Hono()
    .post("/create", async (c) => {
        const roomId = nanoid(5);
        await redis.hset(`meta:${roomId}`, {
            createdAt: Date.now(),
            expireAt: Date.now() + ROOM_TTL_MILISECONDS,
        })

        await redis.expire(`meta:${roomId}`, ROOM_TTL_MILISECONDS / 1000)

        return c.json({ roomId })
    })
    .get("/history", async (c) => {
        const roomId = c.req.query("roomId");
        const parsed = historySchema.safeParse({ roomId });
        if (!parsed.success) {
            return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
        }

        const { roomId: validRoomId } = parsed.data;
        const rawMessages = await redis.xrange(`messages:${validRoomId}`, '-', '+', 100);

        const formatted: Array<{
            streamId: string;
            text: string;
            sender: string;
            username: string;
            time: number;
            iv: string;
            isCode: boolean;
        }> = [];

        if (rawMessages && typeof rawMessages === 'object') {
            for (const [id, fields] of Object.entries(rawMessages)) {
                const f = fields as Record<string, string>;
                formatted.push({
                    streamId: id,
                    text: f.text || '',
                    sender: f.sender || '',
                    username: f.username || '',
                    time: f.time ? parseInt(f.time) : Date.now(),
                    iv: f.iv || '',
                    isCode: String(f.isCode) === 'true',
                });
            }
        }

        return c.json({ messages: formatted });
    })
    .post("/destroy", async (c) => {
        const body = await c.req.json();
        const parsed = destroySchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
        }

        const { roomId, token } = parsed.data;
        const isMember = await redis.sismember(`room:${roomId}:users`, token);
        if (!isMember) {
            return c.json({ error: "Not authorized to destroy this room" }, 403);
        }
        await redis.del(`meta:${roomId}`)
        await redis.del(`room:${roomId}:users`)
        await redis.del(`messages:${roomId}`)
        return c.json({ success: true })
    })


const routes = new Hono()
    .basePath("/api")
    .use('/*', cors())
    .route('/room', roomApp);

export type AppType = typeof routes;


export const GET = handle(routes)
export const POST = handle(routes)

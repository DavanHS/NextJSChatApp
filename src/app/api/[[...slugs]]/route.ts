import { redis } from '@/lib/redis';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { nanoid } from 'nanoid'

export const ROOM_TTL_MILISECONDS = 60 * 10 * 1000



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
    .post("/destroy", async (c) => {
        /*
        TODO:
        1. Handling the request with authorization access. 
        */
        const body = await c.req.json();
        const roomId = body.roomId as string;
        await redis.publish(roomId, JSON.stringify({
            type: "ROOM_DESTROYED",
            text: "Room was destroyed by host."
        }))
        await redis.del(`meta:${roomId}`)
        await redis.del(`room:${roomId}:users`)
        return c.json({ success: true })
    })


const routes = new Hono()
    .basePath("/api")
    .use('/*', cors())
    .route('/room', roomApp);

export type AppType = typeof routes;


export const GET = handle(routes)
export const POST = handle(routes)

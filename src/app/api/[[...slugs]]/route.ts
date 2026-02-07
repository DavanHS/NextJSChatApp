import { redis } from '@/lib/redis';
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth';
import z, { success } from 'zod';

export const ROOM_TTL_MILISECONDS = 60 * 10 * 1000

const rooms = new Elysia({ prefix: "/room" })
    .post("/create", async () => {
        const roomId = nanoid();

        await redis.hset(`meta:${roomId}`, {
            connected: [],
            expireAt: Date.now() + ROOM_TTL_MILISECONDS,
        })

        await redis.expire(`meta:${roomId}`, ROOM_TTL_MILISECONDS/1000)

        return { roomId }
    })
    .post("/destroy", async ({body}) => {
        const {roomId} = body as {roomId: string};
        await redis.publish(roomId, JSON.stringify({
            type: "ROOM_DESTROYED",
            text: "Room was destroyed by host."
        }))
        await redis.del(`meta:${roomId}`)
        return {success: true}
    })

export const app = new Elysia({ prefix: '/api' })
    .use(rooms)


export const GET = app.fetch
export const POST = app.fetch

import { redis } from '@/lib/redis';
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth';
import z from 'zod';

const ROOM_TTL_SECONDS = 60 * 10

const rooms = new Elysia({ prefix: "/room" })
    .post("/create", async () => {
        const roomId = nanoid();

        await redis.hset(`meta:${roomId}`, {
            connected: [],
            createdAt: Date.now(),
        })

        await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

        return { roomId }
    })

const messages = new Elysia({ prefix: "/messages" }).use(authMiddleware).post("/", async ({ body, auth }) => {
    const { sender, text } = body

    const roomExists = await redis.exists(`meta:${auth.roomId}`)

    if(!roomExists){
        throw new Error("Room does not exist")
    }

}, {
    query: z.object({ roomId: z.string() }),
    body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000)
    })
})


export const app = new Elysia({ prefix: '/api' })
    .use(rooms)


export const GET = app.fetch
export const POST = app.fetch

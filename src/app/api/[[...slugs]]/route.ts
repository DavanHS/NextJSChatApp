import { redis } from '@/lib/redis';
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth';
import z from 'zod';

export const ROOM_TTL_MILISECONDS = 60 * 0.1 * 1000

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

export const app = new Elysia({ prefix: '/api' })
    .use(rooms)


export const GET = app.fetch
export const POST = app.fetch

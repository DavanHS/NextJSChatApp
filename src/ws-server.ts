import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { redis } from './lib/redis'

const PORT = 8080

const app = new Elysia()
    .use(cors({
        origin: process.env.NEXT_PUBLIC_URL,
        credentials: true
    }))
    .ws('/ws', {
        query: t.Object({
            roomId: t.String()
        }),

        async open(ws) {
            const { roomId } = ws.data.query

            const cookieHeader = ws.data.request.headers.get('cookie') || ''
            const token = cookieHeader
                .split(';')
                .find(c => c.trim().startsWith('x-auth-token='))
                ?.split('=')[1]

            if (!token) {
                ws.send({ error: 'Unauthorized: No token found' })
                ws.close()
                return
            }

            const meta = await redis.hgetall<{ connected: string[] }>(`meta:${roomId}`)

            if (!meta || !meta.connected.includes(token)) {
                ws.send({ error: 'Unauthorized: Not joined to room' })
                ws.close()
                return
            }

            ws.subscribe(roomId)
            console.log(`User ${token} connected to room ${roomId}`)
        },

        message(ws, message: any) {
            const { roomId } = ws.data.query
            ws.publish(roomId, {
                ...message,
                time: Date.now()
            })
        },

        close(ws) {
            const { roomId } = ws.data.query
            ws.unsubscribe(roomId)
        }
    })
    .listen({
        port: process.env.PORT || 8080,
        hostname: '0.0.0.0'
    })

console.log(`WebSocket Server running at ${app.server?.hostname}:${app.server?.port}`)
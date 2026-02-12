import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { redis } from './lib/redis'

const app = new Elysia()
    .use(cors({
        origin: `${process.env.NEXT_PUBLIC_URL}`,
        credentials: true
    }))
    .ws('/ws', {
        query: t.Object({
            roomId: t.String(),
            token: t.String()
        }),

        async open(ws) {
            const { roomId, token } = ws.data.query
            const isAllowed = await redis.sismember(`room:${roomId}:users`, token)

            if (!isAllowed) {
                ws.send({ type: "ERROR", message: "Not authorized" })
                ws.close()
                return
            }

            ws.subscribe(roomId)
            console.log(`User ${token} connected to room ${roomId}`)

            // const joinedRoom = JSON.stringify({
            //     type: "JOINED", 
            //     message: 
            // })
        },

        message(ws, message: any) {
            const { roomId } = ws.data.query

            if (message.type === "PING") {
                ws.send(JSON.stringify({ type: "PONG" }))
                return;
            }

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
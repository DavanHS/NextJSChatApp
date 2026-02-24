import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const proxy = async (req: NextRequest) => {
    const pathname = req.nextUrl.pathname
    if (pathname === "/") {
        return NextResponse.next();
    }
    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)

    if (!roomMatch)
        return NextResponse.redirect(new URL("/", req.url))

    const roomId = roomMatch[1];

    const meta = await redis.hgetall<{ expireAt: string }>(`meta:${roomId}`)

    if (!meta || !meta.expireAt) {
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    let token = req.cookies.get(`x-auth-token-${roomId}`)?.value
    const response = NextResponse.next();

    if (!token) {
        token = nanoid();
        const expireAtNumber = Number(meta.expireAt)
        response.cookies.set(`x-auth-token-${roomId}`, token, {
            path: "/",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            expires: new Date(expireAtNumber)
        })
    }

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store')

    const pipeline = redis.pipeline();
    pipeline.scard(`room:${roomId}:users`);
    pipeline.sismember(`room:${roomId}:users`, token);

    const [count, isMember] = await pipeline.exec() as [number, number];

    if (isMember === 0 && count >= 3) {
        return NextResponse.redirect(new URL("/?error=room-is-full", req.url))
    }

    if (isMember === 0) {
        await redis.sadd(`room:${roomId}:users`, token)

        await redis.expire(`room:${roomId}:users`, 60 * 10)
    }

    return response
}

export const config = {
    matcher: ["/", "/room/:path*"]
}
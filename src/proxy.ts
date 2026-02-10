import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const proxy = async (req: NextRequest) => {
    const pathname = req.nextUrl.pathname
if (pathname === "/") {
        const token = req.cookies.get("x-auth-token")?.value
        if (token) return NextResponse.next();
        const newToken = nanoid();
        const response = NextResponse.next();
        
        response.cookies.set("x-auth-token", newToken, {
            path: "/",
            httpOnly: false, 
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30
        })

        return response;
    }
    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)

    if (!roomMatch)
        return NextResponse.redirect(new URL("/", req.url))

    const roomId = roomMatch[1];

    const exists = await redis.exists(`meta:${roomId}`)

    if (!exists)
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url))


    const token = req.cookies.get("x-auth-token")?.value
    if (!token) {
        return NextResponse.redirect(new URL("/", req.url))
    }

    const response = NextResponse.next();

    const pipeline = redis.pipeline();
    pipeline.scard(`room:${roomId}:users`);
    pipeline.sismember(`room:${roomId}:users`, token);

    const [count, isMember] = await pipeline.exec() as [number, number];

    if (isMember === 0 && count >= 2) {
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
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { nanoid } from "nanoid";
import { redis } from "./lib/redis";

type IncomingPing = {
  type: "PING";
};

type IncomingMessage = {
  text: string;
  sender: string;
  username?: string;
};

type StoredMessage = {
  id: string;
  type: "CHAT_MESSAGE";
  text: string;
  sender: string;
  username: string;
  time: number;
};

const getHistoryKey = (roomId: string) => `room:${roomId}:messages`;

const app = new Elysia()
  .use(
    cors({
      origin: `${process.env.NEXT_PUBLIC_URL}`,
      credentials: true,
    }),
  )
  .ws("/ws", {
    query: t.Object({
      roomId: t.String(),
      token: t.String(),
      username: t.Optional(t.String()),
    }),

    async open(ws) {
      const { roomId, token, username } = ws.data.query;
      const isAllowed = await redis.sismember(`room:${roomId}:users`, token);

      if (!isAllowed) {
        ws.send({ type: "ERROR", message: "Not authorized" });
        ws.close();
        return;
      }

      const history = await redis.lrange<string>(getHistoryKey(roomId), 0, -1);
      const messages = history
        .map((entry) => {
          try {
            return JSON.parse(entry) as StoredMessage;
          } catch {
            return null;
          }
        })
        .filter((message): message is StoredMessage => Boolean(message));

      ws.send({
        type: "HISTORY_SYNC",
        messages,
      });

      ws.subscribe(roomId);
      console.log(`User ${token} connected to room ${roomId}`);

      ws.publish(roomId, {
        type: "USER_JOINED",
        token,
        username,
        time: Date.now(),
      });
    },

    async message(ws, rawMessage: unknown) {
      const { roomId } = ws.data.query;
      const parsedMessage =
        typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;

      if (!parsedMessage || typeof parsedMessage !== "object") {
        return;
      }

      if ((parsedMessage as IncomingPing).type === "PING") {
        ws.send({ type: "PONG" });
        return;
      }

      const chatMessage = parsedMessage as IncomingMessage;

      if (!chatMessage.text?.trim()) {
        return;
      }

      const normalizedMessage: StoredMessage = {
        id: nanoid(),
        type: "CHAT_MESSAGE",
        text: chatMessage.text,
        sender: chatMessage.sender,
        username: chatMessage.username || "anonymous",
        time: Date.now(),
      };

      const historyKey = getHistoryKey(roomId);
      await redis.rpush(historyKey, JSON.stringify(normalizedMessage));
      await redis.ltrim(historyKey, -200, -1);

      const expireAt = await redis.hget<number>(`meta:${roomId}`, "expireAt");
      if (expireAt) {
        const ttlSeconds = Math.max(Math.ceil((expireAt - Date.now()) / 1000), 1);
        await redis.expire(historyKey, ttlSeconds);
      }

      ws.publish(roomId, normalizedMessage);
    },

    close(ws) {
      const { roomId } = ws.data.query;
      ws.unsubscribe(roomId);
    },
  })
  .listen({
    port: process.env.PORT || 8080,
    hostname: "0.0.0.0",
  });

console.log(`WebSocket Server running at ${app.server?.hostname}:${app.server?.port}`);

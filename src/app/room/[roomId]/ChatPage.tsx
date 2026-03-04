"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type ChatMessage = {
  id: string;
  type: "CHAT_MESSAGE";
  text: string;
  sender: string;
  username: string;
  time: number;
};

type WsEvent =
  | { type: "ROOM_DESTROYED"; text?: string }
  | { type: "PONG" }
  | { type: "PING" }
  | { type: "ERROR"; message: string }
  | { type: "USER_JOINED"; token: string; username?: string }
  | { type: "HISTORY_SYNC"; messages: ChatMessage[] }
  | ChatMessage;

const ChatPage = ({
  roomId,
  token,
  expireAt,
}: {
  roomId: string;
  token: string;
  expireAt: number;
}) => {
  const router = useRouter();
  const { timeLeft } = useCountdown(expireAt);
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username] = useState(() => {
    if (typeof window === "undefined") {
      return "anonymous";
    }
    return localStorage.getItem("chat_username") || "anonymous";
  });
  const [isWsOpen, setIsWsOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId || !username || username === "anonymous") {
      return;
    }

    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?roomId=${roomId}&token=${token}&username=${encodeURIComponent(username)}`,
    );

    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsOpen(true);
    };

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 30_000);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as WsEvent;

      if (data.type === "ROOM_DESTROYED") {
        router.push("/");
        return;
      }

      if (data.type === "PONG" || data.type === "PING") {
        return;
      }

      if (data.type === "ERROR") {
        console.log(data.message);
        router.push("/");
        return;
      }

      if (data.type === "HISTORY_SYNC") {
        setMessages(data.messages || []);
        return;
      }

      if (data.type === "USER_JOINED") {
        const toastId = nanoid();
        const joinedName = data.username || data.token;
        const joinText = data.token === token ? "You joined the room" : `${joinedName} joined the room`;

        setToasts((prev) => [...prev, { id: toastId, text: joinText }]);

        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
        }, 3000);

        return;
      }

      if (data.type === "CHAT_MESSAGE") {
        setMessages((prev) => {
          if (prev.some((message) => message.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      }
    };

    return () => {
      clearInterval(heartbeatInterval);
      setIsWsOpen(false);
      ws.close();
    };
  }, [roomId, router, token, username]);

  useEffect(() => {
    if (timeLeft <= 0) {
      router.push("/");
    }
  }, [router, timeLeft]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || !isWsOpen) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        text: input,
        sender: token,
        username,
      }),
    );

    setInput("");
    inputRef.current?.focus();
  };

  const handleDestroy = async () => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "ROOM_DESTROYED",
          text: "Room is destroyed",
        }),
      );
    }

    router.push("/");

    await fetch("/api/room/destroy", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, token }),
    });
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url.split("room/")[1]);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy"), 2000);
  };

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-black font-sans text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium tracking-wider text-zinc-500">ROOM ID</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wide text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Self-Destruct
            </span>
            <span
              suppressHydrationWarning
              className={`flex items-center font-mono text-sm font-bold ${
                timeLeft !== null && timeLeft < 60 ? "text-red-500" : "text-amber-500"
              }`}
            >
              {timeLeft !== null ? formatTimeRemaining(timeLeft) : "--:--"}
            </span>
          </div>
        </div>
        <button
          onClick={handleDestroy}
          className="flex items-center gap-2 rounded bg-red-600 px-3 py-2 text-xs font-bold tracking-wider text-white shadow-lg shadow-red-900/20 transition-all hover:scale-105 hover:bg-red-700 active:scale-95"
        >
          DESTROY NOW
        </button>
      </header>

      <div className="scrollbar-thumb-zinc-800 scrollbar-track-transparent flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-md tracking-wider text-zinc-600">
              No messages yet... Send a message to start.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.sender === token;
            return (
              <div key={message.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="mb-1 flex items-center gap-2 px-1">
                  <span className="font-mono text-[10px] text-zinc-500">
                    {isMe ? "You" : message.username || message.sender}
                  </span>
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl border px-4 py-2 text-sm whitespace-pre-wrap break-words font-mono ${
                    isMe
                      ? "rounded-tr-sm border-green-600/30 bg-green-600/20 text-green-100"
                      : "rounded-tl-sm border-zinc-700/50 bg-zinc-800/50 text-zinc-200"
                  }`}
                >
                  {message.text}
                </div>
                <span className="mt-1 px-1 text-[10px] text-zinc-600">
                  {new Date(message.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900/30 p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <div className="group relative flex-1">
            <span className="absolute left-4 top-4 -translate-y-1/2 animate-pulse font-mono text-green-500">
              {">"}
            </span>
            <textarea
              ref={inputRef}
              placeholder={isWsOpen ? "Type message / paste code..." : "Connecting..."}
              autoFocus
              disabled={!isWsOpen}
              value={input}
              rows={4}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && input.trim() && isWsOpen) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              className="w-full resize-none rounded-md border border-zinc-800 bg-black py-3 pl-8 pr-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-700 outline-none transition-all focus:border-green-900/50 focus:ring-1 focus:ring-green-900/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isWsOpen}
            className="rounded-md bg-zinc-100 px-6 text-sm font-bold text-black transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            SEND
          </button>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="animate-in slide-in-from-bottom-2 fade-in break-normal whitespace-nowrap rounded border border-zinc-700 bg-zinc-800/90 px-4 py-2 font-mono text-xs text-zinc-200 shadow-xl duration-300"
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default ChatPage;

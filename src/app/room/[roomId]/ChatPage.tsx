"use client";
import { useCountdown } from "@/hooks/useCountdown";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatTimeRemaining(seconds: number) {
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Message = {
  text: string;
  sender: string;
  time: number;
};

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
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messages.length > 0) {
        sessionStorage.setItem(
          `chat_history_${roomId}`,
          JSON.stringify({
            messages: messages,
            timestamp: Date.now(),
          }),
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [messages, roomId]);

  useEffect(() => {
    const savedMsg = sessionStorage.getItem(`chat_history_${roomId}`);
    if (savedMsg) {
      const parsed = JSON.parse(savedMsg);
      if (Date.now() > expireAt) {
        sessionStorage.removeItem(`chat_history_${roomId}`);
        setMessages([]);
      } else {
        setMessages(parsed.messages);
      }
    } else {
      setMessages([]);
    }
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?roomId=${roomId}&token=${token}`,
    );
    wsRef.current = ws;

    const heartBeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 30000);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "ROOM_DESTROYED") {
        router.push("/");
        return;
      }
      if (data.type === "PONG" || data.type === "PING") {
        return;
      }

      if(data.type === "ERROR"){
        router.push("/");
        console.log(data.message);
      }

      if (data.error) {
        console.error("WS Error:", data.error);
        return;
      }

      setMessages((prev) => [...prev, data]);
    };

    return () => {
      clearInterval(heartBeatInterval);
      ws.close();
    };
  }, [roomId, router, token]);

  const handleDestroy = async () => {
    setMessages([]);
    console.log(messages);
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

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;

    const messagePayload = {
      text: input,
      sender: token,
      time: Date.now(),
    };

    wsRef.current.send(JSON.stringify(messagePayload));

    setMessages((prev) => [...prev, messagePayload]);
    setInput("");
    inputRef.current?.focus();
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url.split("room/")[1]);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy"), 2000);
  };
  useEffect(() => {
    if (timeLeft <= 0) {
      router.push("/");
    }
  }, [timeLeft, router]);

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-black text-zinc-100 font-sans">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 font-medium tracking-wider">
              ROOM ID
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-green-500 tracking-wide">
                {roomId}
              </span>
              <button
                onClick={() => copyLink()}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors uppercase font-bold"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider">
              Self-Destruct
            </span>
            <span
              suppressHydrationWarning={true}
              className={`text-sm font-mono font-bold flex items-center ${
                timeLeft !== null && timeLeft < 60
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {timeLeft !== null ? formatTimeRemaining(timeLeft) : "--:--"}
            </span>
          </div>
        </div>
        <button
          onClick={handleDestroy}
          className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-3 py-2 text-xs font-bold tracking-wider rounded shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95"
        >
          DESTROY NOW
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {messages.map((msg, i) => {
          const isMe = msg.sender === token;
          return (
            <div
              key={i}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  isMe
                    ? "bg-green-600/20 text-green-100 border border-green-600/30 rounded-tr-sm"
                    : "bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-zinc-600 mt-1 px-1">
                {new Date(msg.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse font-mono">
              {">"}
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type Message..."
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage();
                }
              }}
              className="w-full bg-black text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm border border-zinc-800 focus:border-green-900/50 focus:ring-1 focus:ring-green-900/50 transition-all outline-none rounded-md"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-6 bg-zinc-100 text-black font-bold text-sm hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default ChatPage;

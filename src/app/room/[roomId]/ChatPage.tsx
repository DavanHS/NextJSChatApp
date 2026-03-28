"use client";
import { useCountdown } from "@/hooks/useCountdown";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";

function formatTimeRemaining(seconds: number) {
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Message = {
  text: string;
  sender: string;
  username: string;
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
  const [username, setUsername] = useState("anonymous");
  const [isWsOpen, setIsWsOpen] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("chat_username");
    if (stored) setUsername(stored);
  }, []);

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
    if (!roomId || !username || username === "anonymous") return;
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?roomId=${roomId}&token=${token}&username=${encodeURIComponent(username)}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsOpen(true);
    };

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

      if (data.type === "ERROR") {
        router.push("/");
        console.log(data.message);
        return;
      }

      if (data.type === "WARNING") {
        const toastId = nanoid();
        setToasts((prev) => [...prev, { id: toastId, text: data.message }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 5000);
        return;
      }

      if (data.error) {
        console.error("WS Error:", data.error);
        return;
      }

      if (data.type === "USER_JOINED") {
        const toastId = nanoid();
        let joinText = "";
        const joinedName = data.username || data.token;
        if (data.token === token) {
          joinText = "You joined the room";
        } else {
          joinText = `${joinedName} joined the room`;
        }
        setToasts((prev) => [...prev, { id: toastId, text: joinText }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
        return;
      }

      if (data.type === "MESSAGE" && data.payload) {
        // console.log(data.payload);
        // console.log("from server:", messages)
        setMessages((prev) => [...prev, data.payload]);
      }
    };

    return () => {
      clearInterval(heartBeatInterval);
      setIsWsOpen(false);
      ws.close();
    };
  }, [roomId, router, token, username]);

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

    await fetch("/api/room/destroy", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, token }),
    });
    router.push("/");
  };

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;

    const messagePayload: Message = {
      text: input,
      sender: token,
      username: username,
      time: Date.now(),
    };

    // console.log(messagePayload)

    wsRef.current.send(
      JSON.stringify({
        type: "MESSAGE",
        payload: messagePayload,
      }),
    );

    setMessages((prev) => [...prev, messagePayload]);
    // console.log("Client side:",messages)
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
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-md font-mono tracking-wider">
              No messages yet... Send a generic message to start.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender === token;
            return (
              <div
                key={i}
                className={`flex flex-col ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {isMe ? "You" : msg.username || msg.sender}
                  </span>
                  {/* {isMe && (
                    // <span className="text-[10px] text-green-500 font-mono bg-green-500/10 px-1 rounded">
                    //   (you)
                    // </span>
                  )} */}
                </div>
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
          })
        )}
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
              placeholder={isWsOpen ? "Type Message..." : "Connecting..."}
              autoFocus
              disabled={!isWsOpen}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim() && isWsOpen && !isRateLimited) {
                  sendMessage();
                }
              }}
              className="w-full bg-black text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm border border-zinc-800 focus:border-green-900/50 focus:ring-1 focus:ring-green-900/50 transition-all outline-none rounded-md disabled:opacity-50"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isWsOpen || isRateLimited}
            className="px-6 bg-zinc-100 text-black font-bold text-sm hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md"
          >
            SEND
          </button>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="px-4 py-2 bg-zinc-800/90 text-zinc-200 text-xs font-mono rounded border border-zinc-700 shadow-xl break-normal whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300"
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

"use client";
import { useCountdown } from "@/hooks/useCountdown";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { deriveKey, encrypt, decrypt } from "@/lib/crypto";
import { highlightCode } from "@/lib/codeHighlight";
import { Code, Copy, Check } from "lucide-react";

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Message = {
  text: string;
  sender: string;
  username: string;
  time: number;
  iv?: string;
  isCode: boolean; // true for code snippets, false for regular text
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null); // tracks which code block shows "Copied"
  const [isCodeForNextMessage, setIsCodeForNextMessage] = useState(false); // set by paste detection or toggle
  const [messages, setMessages] = useState<Message[]>([]);
  const [username] = useState(() => (typeof Window !== "undefined" ? localStorage.getItem("chat_username") : "anonymous") ||  "anonymous");
  const [isWsOpen, setIsWsOpen] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");
  const [isKeyReady, setIsKeyReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDestroyingRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const keyRef = useRef<CryptoKey | null>(null);
  const prevMsgCountRef = useRef(0);
  const wsCancelledRef = useRef(false);
  const prevInputLenRef = useRef(0);
  const [decryptedMessages, setDecryptedMessages] = useState<{ text: string; sender: string; username: string; time: number; isCode: boolean }[]>([]);


  useEffect(() => {
    if (!keyRef.current || messages.length === 0) {
      setDecryptedMessages([]);
      prevMsgCountRef.current = 0;
      return;
    }

    let cancelled = false;
    const key = keyRef.current;

    if (messages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      // New messages added — only decrypt the new ones and append
      const newMessages = messages.slice(prevMsgCountRef.current);
      Promise.all(
        newMessages.map(async (msg) => ({
          text: msg.iv ? await decrypt(msg.text, msg.iv, key) : msg.text,
          sender: msg.sender,
          username: msg.username,
          time: msg.time,
          isCode: msg.isCode, // pass through the code flag for rendering
        }))
      ).then((result) => {
        if (!cancelled) {
          setDecryptedMessages((prev) => [...prev, ...result]);
          prevMsgCountRef.current = messages.length;
        }
      });
    } else {
      // Messages reset or key changed — decrypt all (refresh, room clear, key ready)
      Promise.all(
        messages.map(async (msg) => ({
          text: msg.iv ? await decrypt(msg.text, msg.iv, key) : msg.text,
          sender: msg.sender,
          username: msg.username,
          time: msg.time,
          isCode: msg.isCode,
        }))
      ).then((result) => {
        if (!cancelled) {
          setDecryptedMessages(result);
          prevMsgCountRef.current = messages.length;
        }
      });
    }

    return () => { cancelled = true; };
  }, [messages, isKeyReady]);

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

  // Scroll to bottom when decrypted messages change (not encrypted messages state)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  // Auto-expand textarea as user types — grows up to max height, then scrolls
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollH}px`;
      // Hide scrollbar when content fits, show when it exceeds max (192px = max-h-48)
      textareaRef.current.style.overflowY = scrollH > 192 ? "auto" : "hidden";
    }
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    deriveKey(roomId).then((key) => {
      if (!cancelled) {
        keyRef.current = key;
        setIsKeyReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !username || username === "anonymous") return;
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?roomId=${roomId}&token=${token}&username=${encodeURIComponent(username)}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsOpen(true);
      setConnectionStatus("connected");
      retryCountRef.current = 0;
    };

    const heartBeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 30000);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "ROOM_DESTROYED") {
        sessionStorage.removeItem(`chat_history_${roomId}`);
        const toastId = nanoid();
        setToasts((prev) => [...prev, { id: toastId, text: data.text || "Room was destroyed" }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
        setTimeout(() => router.push("/"), 1500);
        return;
      }
      if (data.type === "PONG" || data.type === "PING") {
        return;
      }

      if (data.type === "ERROR") {
        const toastId = nanoid();
        setToasts((prev) => [...prev, { id: toastId, text: data.message }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
        setTimeout(() => router.push("/"), 1500);
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

    ws.onclose = () => {
      clearInterval(heartBeatInterval);
      setIsWsOpen(false);

      if (wsCancelledRef.current) return;
      if (isDestroyingRef.current) {
        setConnectionStatus("disconnected");
        return;
      }
      if (timeLeft <= 0) {
        setConnectionStatus("disconnected");
        return;
      }

      setConnectionStatus("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current++;

      console.log(`WS reconnecting in ${delay / 1000}s (attempt ${retryCountRef.current})...`);
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectKey((prev) => prev + 1);
      }, delay);
    };

    return () => {
      wsCancelledRef.current = true;
      clearInterval(heartBeatInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.close();
    };
  }, [roomId, router, token, username, reconnectKey]);

  const handleDestroy = async () => {
    isDestroyingRef.current = true; // prevent reconnection on intentional close
    setMessages([]);
    sessionStorage.removeItem(`chat_history_${roomId}`);
    // console.log(messages);
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "ROOM_DESTROYED",
          text: `${username} destroyed the room`,
        }),
      );
    }

    await fetch("/api/room/destroy", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, token }),
    });
    // Show toast before redirecting
    const toastId = nanoid();
    setToasts((prev) => [...prev, { id: toastId, text: "Room destroyed" }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3000);
    setTimeout(() => router.push("/"), 1500);
  };

  const sendMessage = async () => {
    if (!input.trim() || !wsRef.current || !keyRef.current) return;

    const { ciphertext, iv } = await encrypt(input, keyRef.current);

    const messagePayload: Message = {
      text: ciphertext,
      iv: iv,
      sender: token,
      username: username,
      time: Date.now(),
      isCode: isCodeForNextMessage,
    };

    wsRef.current.send(
      JSON.stringify({
        type: "MESSAGE",
        payload: messagePayload,
      }),
    );

    setMessages((prev) => [...prev, messagePayload]);
    setInput("");
    setIsCodeForNextMessage(false);
    textareaRef.current?.focus();
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url.split("room/")[1]);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy"), 2000);
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      sessionStorage.removeItem(`chat_history_${roomId}`);
      const toastId = nanoid();
      setToasts((prev) => [...prev, { id: toastId, text: "Room expired" }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
      setTimeout(() => router.push("/"), 1500);
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "reconnecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-red-500"
              }`}
            />
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {connectionStatus}
            </span>
          </div>
          <button
            onClick={handleDestroy}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-3 py-2 text-xs font-bold tracking-wider rounded shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95"
          >
            DESTROY NOW
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {decryptedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-md font-mono tracking-wider">
              {isKeyReady ? "No messages yet... Send a message to start." : "Securing room..."}
            </p>
          </div>
        ) : (
          decryptedMessages.map((msg, i) => {
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
                </div>

                {/* Code block — black background, syntax highlighting, copy icon */}
                {msg.isCode ? (
                  <div className="relative max-w-[55%] group overflow-x-hidden">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.text);
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="absolute top-2 right-2 p-3 m-3 bg-zinc-800/80 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100 z-10"
                      title="Copy code"
                    >
                      {copiedIndex === i ? <Check size={14} /> : <Copy size={20} />}
                    </button>
                    <pre
                      className="bg-black text-zinc-100 px-4 py-3 rounded-2xl text-sm font-mono border border-zinc-800 overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: highlightCode(msg.text) }}
                    />
                  </div>
                ) : (
                  /* Regular text message */
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm wrap-break-word ${
                      isMe
                        ? "bg-green-600/20 text-green-100 border border-green-600/30 rounded-tr-sm"
                        : "bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
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
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-3 text-green-500 animate-pulse font-mono">
              {">"}
            </span>
            <textarea
              ref={textareaRef}
              placeholder={isWsOpen ? "Type a message or paste code..." : "Connecting..."}
              autoFocus
              disabled={!isWsOpen || !isKeyReady}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                const isMultiLine = pastedText.includes("\n");
                const hasIndentation = pastedText.split("\n").some((l) => /^(  |\t)/.test(l));
                if (isMultiLine && hasIndentation) {
                  setIsCodeForNextMessage(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && input.trim() && isWsOpen && !isRateLimited && isKeyReady) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              className=" align-bottom overflow-hidden w-full bg-black text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm border border-zinc-800 focus:border-green-900/50 focus:ring-1 focus:ring-green-900/50 transition-all outline-none rounded-md disabled:opacity-50 resize-none font-mono max-h-48"
            />
          </div>
          {/* Toggle button — green border when code mode is active */}
          <button
            onClick={() => setIsCodeForNextMessage((prev) => !prev)}
            disabled={!isWsOpen || !isKeyReady}
            className={`p-3 border rounded-md transition-colors flex-shrink-0 ${
              isCodeForNextMessage
                ? "border-green-500 text-green-500 bg-green-500/10"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
            title={isCodeForNextMessage ? "Code mode on" : "Toggle code mode"}
          >
            <Code size={18} />
          </button>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isWsOpen || isRateLimited || !isKeyReady}
            className="px-6 py-3 bg-zinc-100 text-black font-bold text-sm hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md flex-shrink-0"
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

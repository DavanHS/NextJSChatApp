"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";

function formatTimeRemaining(seconds: number) {
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as String;

  const [copyStatus, setCopyStatus] = useState("Copy");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(600);
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy"), 2000);
  };

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500">ROOM ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500">{roomId}</span>
              <button
                onClick={() => copyLink()}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">
              Self-Destruct
            </span>
            <span
              className={`text-sm font-bold gap-2 flex items-center ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"}`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>
        <button className="bg-red-600 hover:bg-red-800 flex items-center gap-2 px-3 py-2 text-sm font-bold text-shadow-white rounded disabled:opacity-50">
          DESTROY NOW
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"></div>

      <div className="mb-10 mx-5  border rounded border-zinc-800 bg-zinc-900/30">
        <div className="flex ">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>
            <input
              type="text"
              placeholder="Type Message..."
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === "Enter" && input.trim()){
                  inputRef.current?.focus()
                }
              }}
              className=" w-full transition-colors outline-none bg-black text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm border border-zinc-800 focus:border-zinc-700"
            />
          </div>
          <button className="flex items-center px-3 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-50cursor-pointer font-bold">
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;

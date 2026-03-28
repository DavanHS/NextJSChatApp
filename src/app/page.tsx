"use client";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

const ANIMALS = ["lion", "tiger", "wolf", "leopard", "cheetah"];
const STORAGE_KEY = "chat_username";

const generateUsername = () => {
  const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${word}-${nanoid(5)}`;
};

// Maps error codes from the proxy middleware to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  "room-not-found": "Room not found or has expired",
  "room-is-full": "Room is full (max 3 users)",
};

function HomeContent() {
  const [username, setUsername] = useState("Your Username");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Read error params from URL (set by proxy middleware on validation failure)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam && ERROR_MESSAGES[errorParam]) {
      setError(ERROR_MESSAGES[errorParam]);
      setIsJoining(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    const main = () => {
      const storedUsername = localStorage.getItem(STORAGE_KEY);
      if (storedUsername) {
        setUsername(storedUsername);
        return;
      }

      const generatedUsername = generateUsername();
      localStorage.setItem(STORAGE_KEY, generatedUsername);
      setUsername(generatedUsername);
    };

    main();
  }, []);

  const joinRoom = () => {
    setIsJoining(true);
    router.push(`/room/${inputRef.current?.value}`);
  };

  const { mutate: createRoom, isPending } = useMutation({
    mutationFn: async () => {
      const res = await client.api.room.create.$post();
      if (res.status === 200) {
        const data = await res.json();
        router.push(`/room/${data.roomId}`);
      }
    },
  });
  return (
    <main className="flex min-h-screen flex-col bg-black items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            termi_chat
          </h1>
          <p className="text-zinc-500 text-sm">self destructing chat room</p>
        </div>

        {error && (
          <div className="flex items-center justify-between border border-red-900/50 bg-red-950/20 px-4 py-3 rounded">
            <span className="text-red-400 text-sm font-mono">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 text-sm font-bold ml-4 transition-colors"
            >
              X
            </button>
          </div>
        )}

        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-400 font-mono">
                  {username}
                </div>
              </div>
            </div>
            <button
              onClick={() => createRoom()}
              disabled={isPending}
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "CREATING..." : "CREATE SECURE ROOM"}
            </button>
            <div className="flex justify-between">
              <input
                placeholder="Enter Room ID"
                ref={inputRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputRef.current?.value.trim()) {
                    joinRoom();
                  }
                }}
                className="border w-full border-zinc-800 bg-zinc-950 p-3 mr-4 outline-none text-sm text-zinc-400 font-mono"
                type="text"
              />
              <button
                onClick={()=>{
                  joinRoom();
                }}
                disabled={isJoining}
                className=" bg-zinc-100 w-full text-black px-6 text-sm  font-bold hover:bg-zinc-50 hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? "JOINING..." : "JOIN"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col bg-black items-center justify-center p-4">
        <div className="text-green-500 font-mono text-sm">Loading...</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}

"use client";

import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ANIMALS = ["lion", "tiger", "wolf", "leopard", "cheetah"];
const STORAGE_KEY = "chat_username";

const generateUsername = () => {
  const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${word}-${nanoid(5)}`;
};

export default function HomeClient() {
  const [username, setUsername] = useState("Your Username");
  const [isJoining, setIsJoining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

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
      const res = await client.room.create.post();
      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">termi_chat</h1>
          <p className="text-sm text-zinc-500">self destructing chat room</p>
        </header>

        <section className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">Your Identity</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {username}
                </div>
              </div>
            </div>
            <button
              onClick={() => createRoom()}
              disabled={isPending}
              className="w-full cursor-pointer bg-zinc-100 p-3 text-sm font-bold text-black transition-colors hover:bg-zinc-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
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
                className="mr-4 w-full border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400 outline-none"
                type="text"
              />
              <button
                onClick={() => {
                  joinRoom();
                }}
                disabled={isJoining}
                className="w-full cursor-pointer bg-zinc-100 px-6 text-sm font-bold text-black transition-colors hover:bg-zinc-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isJoining ? "JOINING..." : "JOIN"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

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

export default function Home() {
  const [username, setUsername] = useState("Your Username");
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
    router.push(`/room/${inputRef.current?.value}`);
  };

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post();
      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            private_chat
          </h1>
          <p className="text-zinc-500 text-sm">self destructing chat room</p>
        </div>

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
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors cursor-pointer disabled:opacity-50"
            >
              CREATE SECURE ROOM
            </button>
            <div className="flex justify-between">
              <input
                placeholder="Enter Room ID"
                ref={inputRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputRef.current?.value.trim()) {
                    joinRoom;
                  }
                }}
                className="border w-full border-zinc-800 p-3 mr-4 outline-none"
                type="text"
              />
              <button
                onClick={joinRoom}
                className=" bg-zinc-100 w-full text-black px-6 text-sm  font-bold hover:bg-zinc-50 hover:text-black transition-colors cursor-pointer disabled:opacity-50"
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
